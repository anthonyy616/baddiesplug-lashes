import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { bookings, notifications, users, bookingServices, bookingAddons } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '@/lib/auth/types';
import type { BookingStatus, AdminBookingAction } from '@/types';
import { queueEmailEvent, getDispatchableEventIds, dispatchEmailEvent } from '@/lib/email/events';
import { getBookingById } from '@/lib/booking';
import { recordBookingEvent } from '@/lib/booking/audit';
import { canTransition, isReschedulable } from '@/lib/booking/lifecycle';
import { validateAdminSlot, isSlotAvailable } from '@/lib/availability';
import { generateBookingReference } from '@/lib/pricing';

// Status actions (normal transitions; canonical matrix in
// src/lib/booking/lifecycle.ts):
//   pending   -> approved | rejected
//   confirmed -> approved | no_show | completed | cancelled
//   approved  -> no_show | completed | cancelled
// RESCHEDULE is a separate command (not a status transition): it atomically
// cancels the original booking and creates a replacement, so it never goes
// through canTransition. Auto-approval means new bookings are created as
// 'confirmed'; admin manually approves (payment proof review). No-show is a
// manually assigned outcome. Ignored is created ONLY by the scheduled job.

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel', 'complete', 'no_show', 'reschedule']),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  newStartTime: z.string().optional(),
  newEndTime: z.string().optional(),
}).refine(
  (data) => {
    if (data.action !== 'reschedule') return true;
    return Boolean(data.newDate && data.newStartTime && data.newEndTime);
  },
  { message: 'Reschedule requires newDate, newStartTime, and newEndTime' }
);

// Target status for NORMAL status actions. Reschedule is not listed: it is
// handled entirely by the dedicated reschedule command below.
const TARGET_STATUS: Partial<Record<AdminBookingAction, BookingStatus>> = {
  approve: 'approved',
  reject: 'rejected',
  cancel: 'cancelled',
  complete: 'completed',
  no_show: 'no_show',
};

// Thrown inside the transaction when the guarded status update affects 0 rows
// (another admin action changed the booking first). Maps to a 409 response.
class ConcurrencyConflictError extends Error {
  constructor() {
    super('Booking was modified concurrently');
    this.name = 'ConcurrencyConflictError';
  }
}

// Thrown when the requested reschedule slot fails validation. Maps to 400.
class SlotValidationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SlotValidationError';
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();

    const { id } = await params;

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { action } = parsed.data;

    // Reschedule is a separate command with its own flow — never run it
    // through the normal status-update path.
    if (action === 'reschedule') {
      const { newDate, newStartTime, newEndTime } = parsed.data;
      return await handleReschedule(request, id, {
        newDate: newDate!,
        newStartTime: newStartTime!,
        newEndTime: newEndTime!,
      }, admin);
    }

    const targetStatus = TARGET_STATUS[action];

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const now = new Date();
    let emailEventBookingId = id;
    let emailEventType: 'booking.confirmed' | 'booking.admin_cancelled' | null = null;
    if (action === 'approve') emailEventType = 'booking.confirmed';
    if (action === 'cancel') emailEventType = 'booking.admin_cancelled';

    await db.transaction(async (tx) => {
      if (!booking || !targetStatus) {
        throw new Error('Unreachable');
      }

      // Single preflight inside the transaction is not enough under
      // concurrency, so the UPDATE itself re-checks the current status: a
      // racing admin action cannot double-apply or clobber a newer status.
      if (!ALLOWED_ACTION_SOURCES[action].includes(booking.status)) {
        throw new ActionSourceError(`Cannot ${action} a ${booking.status} booking`);
      }

      // Defense in depth: also validate against the shared lifecycle matrix.
      if (!canTransition(booking.status as BookingStatus, targetStatus)) {
        throw new ActionSourceError(`Invalid transition ${booking.status} -> ${targetStatus}`);
      }

      // Concurrency-safe, idempotent update: WHERE re-checks the status seen
      // above. If 0 rows match, another action already won.
      const updateValues: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: now,
      };
      if (targetStatus === 'cancelled') updateValues.cancelledAt = now;
      if (targetStatus === 'completed') updateValues.completedAt = now;

      const updated = await tx
        .update(bookings)
        .set(updateValues)
        .where(and(eq(bookings.id, id), eq(bookings.status, booking.status)))
        .returning({ id: bookings.id });

      if (updated.length === 0) {
        throw new ConcurrencyConflictError();
      }

      // Immutable audit trail
      const auditEventType =
        targetStatus === 'cancelled'
          ? ('cancelled' as const)
          : targetStatus === 'approved'
            ? ('approved' as const)
            : targetStatus === 'rejected'
              ? ('rejected' as const)
              : targetStatus === 'completed'
                ? ('completed' as const)
                : ('no_show' as const);
      await recordBookingEvent(
        {
          bookingId: id,
          eventType: auditEventType,
          actorType: 'admin',
          metadata: { reference: booking.reference },
        },
        tx,
      );

      await tx.insert(notifications).values({
        id: uuidv4(),
        type: `booking_${targetStatus}`,
        bookingId: id,
        customerId: booking.customerId,
        title: `Booking ${targetStatus.replace('_', ' ')}`,
        message: `Booking ${booking.reference} was ${targetStatus.replace('_', ' ')} by admin`,
        isRead: false,
        createdAt: now,
      });

      // Customer notification for admin cancel (separate type so admin list can filter it out)
      if (action === 'cancel') {
        await tx.insert(notifications).values({
          id: uuidv4(),
          type: 'customer_booking_cancelled',
          bookingId: id,
          customerId: booking.customerId,
          title: 'Booking Cancelled',
          message: `Your booking ${booking.reference} has been cancelled by admin`,
          isRead: false,
          createdAt: now,
        });
      }

      // No rejection email is required per requirements.
      if (emailEventType) {
        const customer = await tx.query.users.findFirst({
          where: eq(users.id, booking.customerId),
        });

        // Build the email payload from the booking's PERSISTED snapshots so
        // pricing is never missing: the renderer must never fall back to
        // ₦0.00 for a priced event.
        const snapshotServices = await tx.query.bookingServices.findMany({
          where: eq(bookingServices.bookingId, id),
        });
        const snapshotAddons = await tx.query.bookingAddons.findMany({
          where: eq(bookingAddons.bookingId, id),
        });

        await queueEmailEvent(
          {
            eventType: emailEventType,
            recipient: customer?.email || '',
            bookingId: id,
            payload: {
              customerName: customer?.name || 'Customer',
              reference: booking.reference,
              date: booking.appointmentDate,
              startTime: booking.startTime,
              endTime: booking.endTime,
              services: snapshotServices.map((s) => s.serviceNameSnapshot),
              addons: snapshotAddons.map((a) => a.addonNameSnapshot),
              total: booking.total,
              depositRequired: booking.depositRequired,
            },
          },
          tx,
        );
      }
    });

    // Best-effort async dispatch — only after the transaction committed.
    for (const eventId of await getDispatchableEventIds(emailEventBookingId)) {
      dispatchEmailEvent(eventId);
    }

    void admin;

    return NextResponse.json({ success: true, status: targetStatus });
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      return NextResponse.json(
        { error: 'Booking was updated by another action. Refresh and try again.' },
        { status: 409 }
      );
    }
    if (error instanceof ActionSourceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin booking action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Sources for each status action (kept beside the handler; lifecycle matrix
// remains the deeper authority via canTransition).
const ALLOWED_ACTION_SOURCES: Record<string, string[]> = {
  approve: ['pending', 'confirmed'],
  reject: ['pending'],
  cancel: ['pending', 'confirmed', 'approved'],
  complete: ['confirmed', 'approved'],
  no_show: ['confirmed', 'approved'],
};

class ActionSourceError extends Error {}

/**
 * RESCHEDULE COMMAND (P0-1).
 *
 * Separate from the normal status-update path. Policy:
 * - Allowed from 'confirmed' and 'approved' (per RESCHEDULABLE_STATUSES).
 *   'pending' is NOT reschedulable — admins reject/cancel pending bookings.
 * - The new slot is validated BEFORE the original booking is touched.
 * - Atomic: original booking keeps its identity but is marked 'cancelled'
 *   with a reschedule outcome recorded in booking_event; a replacement
 *   booking is created with identical service/add-on snapshots and pricing.
 * - Approval state is preserved: a rescheduled 'approved' booking produces an
 *   'approved' replacement (payment carry-over), a 'confirmed' one produces
 *   'confirmed'.
 * - Both records are linked via previousBookingId and booking_event.
 * - Exactly one replacement booking is created (the transaction either fully
 *   commits or fully rolls back).
 */
async function handleReschedule(
  request: NextRequest,
  id: string,
  data: { newDate: string; newStartTime: string; newEndTime: string },
  admin: unknown,
) {
  try {
    const newDate = data.newDate;
    const newStartTime = data.newStartTime!;
    const newEndTime = data.newEndTime!;

    // Time format validation up-front (admin custom times are allowed, but
    // must be well-formed; business rules checked by the admin slot validator)
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newStartTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(newEndTime)) {
      return NextResponse.json({ error: 'Invalid time format' }, { status: 400 });
    }
    if (newStartTime >= newEndTime) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (!isReschedulable(booking.status)) {
      return NextResponse.json(
        { error: `Cannot reschedule a ${booking.status} booking` },
        { status: 400 },
      );
    }

    // Validate the new slot BEFORE mutating the original. Admin custom times
    // are allowed (business-hours/overlap/override checks inside).
    const slotValidation = await validateAdminSlot(newDate, newStartTime, newEndTime, id);
    if (!slotValidation.valid) {
      throw new SlotValidationError(slotValidation.error || 'Slot not available');
    }

    // Preserve approval/payment state: approved stays approved.
    const replacementStatus: BookingStatus =
      booking.status === 'approved' ? 'approved' : 'confirmed';

    const newBookingId = uuidv4();
    const newReference = generateBookingReference();
    const now = new Date();

    await db.transaction(async (tx) => {
      // Guarded cancel of the original: only if it is still in the status we
      // validated against. 0 rows = racing admin action won.
      const cancelledOld = await tx
        .update(bookings)
        .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
        .where(and(eq(bookings.id, id), eq(bookings.status, booking.status)))
        .returning({ id: bookings.id });

      if (cancelledOld.length === 0) {
        throw new ConcurrencyConflictError();
      }

      // Snapshots copied BEFORE creating the replacement
      const oldServices = await tx.query.bookingServices.findMany({
        where: eq(bookingServices.bookingId, id),
      });
      const oldAddons = await tx.query.bookingAddons.findMany({
        where: eq(bookingAddons.bookingId, id),
      });

      // Replacement booking: same customer, same pricing snapshots, same
      // approval state, linked to the original.
      await tx.insert(bookings).values({
        id: newBookingId,
        reference: newReference,
        customerId: booking.customerId,
        appointmentDate: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        status: replacementStatus,
        phone: booking.phone,
        customerNotes: booking.customerNotes,
        subtotal: booking.subtotal,
        depositRequired: booking.depositRequired,
        total: booking.total,
        previousBookingId: id,
        createdAt: now,
        updatedAt: now,
      });

      if (oldServices.length > 0) {
        await tx.insert(bookingServices).values(
          oldServices.map((s) => ({
            id: uuidv4(),
            bookingId: newBookingId,
            serviceId: s.serviceId,
            serviceNameSnapshot: s.serviceNameSnapshot,
            unitPriceSnapshot: s.unitPriceSnapshot,
          }))
        );
      }

      if (oldAddons.length > 0) {
        await tx.insert(bookingAddons).values(
          oldAddons.map((a) => ({
            id: uuidv4(),
            bookingId: newBookingId,
            addonId: a.addonId,
            addonNameSnapshot: a.addonNameSnapshot,
            unitPriceSnapshot: a.unitPriceSnapshot,
            quantity: a.quantity,
          }))
        );
      }

      // Audit: original records the reschedule outcome + link to replacement
      await recordBookingEvent(
        {
          bookingId: id,
          eventType: 'rescheduled',
          actorType: 'admin',
          relatedBookingId: newBookingId,
          metadata: {
            reference: booking.reference,
            newReference,
            oldDate: booking.appointmentDate,
            oldStartTime: booking.startTime,
            oldEndTime: booking.endTime,
            newDate,
            newStartTime,
            newEndTime,
            wasApproved: booking.status === 'approved',
          },
        },
        tx,
      );
      // Audit: replacement records its creation-by-reschedule + link back
      await recordBookingEvent(
        {
          bookingId: newBookingId,
          eventType: 'created',
          actorType: 'admin',
          relatedBookingId: id,
          metadata: {
            reference: newReference,
            rescheduledFrom: booking.reference,
            wasApproved: replacementStatus === 'approved',
          },
        },
        tx,
      );

      // Admin action notification (shows in admin list)
      await tx.insert(notifications).values({
        id: uuidv4(),
        type: 'booking_rescheduled',
        bookingId: id,
        customerId: booking.customerId,
        title: 'Booking Rescheduled',
        message: `Booking ${booking.reference} was rescheduled by admin to ${newReference}`,
        isRead: false,
        createdAt: now,
      });

      // Customer notification
      const customer = await tx.query.users.findFirst({
        where: eq(users.id, booking.customerId),
      });

      await tx.insert(notifications).values({
        id: uuidv4(),
        type: 'customer_booking_rescheduled',
        bookingId: newBookingId,
        customerId: booking.customerId,
        title: 'Booking Rescheduled',
        message: `Your booking ${booking.reference} has been rescheduled from ${booking.appointmentDate} ${booking.startTime} to ${newDate} ${newStartTime} (ref ${newReference})`,
        isRead: false,
        createdAt: now,
      });

      // Reschedule email: goes ONLY to the customer, contains old AND new
      // appointment data plus approval/payment carry-over state.
      await queueEmailEvent(
        {
          eventType: 'booking.rescheduled',
          recipient: customer?.email || '',
          bookingId: newBookingId,
          payload: {
            customerName: customer?.name || 'Customer',
            reference: newReference,
            previousReference: booking.reference,
            date: newDate,
            startTime: newStartTime,
            endTime: newEndTime,
            previousDate: booking.appointmentDate,
            previousStartTime: booking.startTime,
            previousEndTime: booking.endTime,
            wasApproved: booking.status === 'approved',
            services: oldServices.map((s) => s.serviceNameSnapshot),
            addons: oldAddons.map((a) => a.addonNameSnapshot),
          },
        },
        tx,
      );

      void admin;
    });

    // Dispatch after commit — both the old and new booking ids carry events.
    const eventIds = [
      ...(await getDispatchableEventIds(id)),
      ...(await getDispatchableEventIds(newBookingId)),
    ];
    for (const eventId of eventIds) {
      dispatchEmailEvent(eventId);
    }

    return NextResponse.json({
      success: true,
      status: 'rescheduled',
      previousStatus: booking.status,
      newBookingId,
      newReference,
    });
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      return NextResponse.json(
        { error: 'Booking was updated by another action. Refresh and try again.' },
        { status: 409 }
      );
    }
    if (error instanceof SlotValidationError) {
      return NextResponse.json({ error: `Reschedule failed: ${error.message}` }, { status: 400 });
    }
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin reschedule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;
    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ booking });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin booking fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
