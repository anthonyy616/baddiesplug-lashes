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
import { cancelPendingReminders } from '@/lib/jobs';
import { recordBookingEvent } from '@/lib/booking/audit';
import { canTransition } from '@/lib/booking/lifecycle';
import {
  adminRescheduleBooking,
  ConcurrencyConflictError,
  SlotValidationError,
} from '@/lib/booking/reschedule';
import { invalidateAvailabilityCache } from '@/lib/availability';

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
  // Customer-safe reschedule reason (Stage 4): persisted in the audit trail
  // and included in the customer's confirmation email.
  reason: z.string().max(1000).optional(),
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

// ConcurrencyConflictError and SlotValidationError are imported from the
// shared reschedule domain module (src/lib/booking/reschedule.ts) so the
// status-update path and the reschedule command share one error contract.

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
      const { newDate, newStartTime, newEndTime, reason } = parsed.data;
      return await handleReschedule(request, id, {
        newDate: newDate!,
        newStartTime: newStartTime!,
        newEndTime: newEndTime!,
        reason,
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

      // Suppress pending reminders for cancelled bookings.
      if (targetStatus === 'cancelled') {
        await cancelPendingReminders(id);
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

    // Status changed — the slot may have been released.
    invalidateAvailabilityCache(booking.appointmentDate);

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
 * RESCHEDULE COMMAND (Stage 4, Rescheduling V2).
 *
 * Thin API adapter: all policy and data mutation live in the shared domain
 * command adminRescheduleBooking() (src/lib/booking/reschedule.ts) so the
 * admin bookings API, the calendar, and any future admin surface use ONE
 * authoritative implementation.
 *
 * Policy (in the domain command):
 * - Eligible statuses: 'confirmed' and 'approved' (RESCHEDULABLE_STATUSES).
 * - New slot validated BEFORE the original is touched.
 * - Fully transactional: guarded cancel + replacement insert commit or roll
 *   back together; the unique index remains the double-booking race guard.
 * - Snapshots and historical totals are preserved; approval state carries
 *   over; both records stay linked for A -> B -> C traceability.
 * - Optional customer-safe reason is persisted in booking_event and included
 *   in the durable customer email.
 */
async function handleReschedule(
  request: NextRequest,
  id: string,
  data: { newDate: string; newStartTime: string; newEndTime: string; reason?: string },
  admin: { id: string; name: string },
) {
  try {
    const result = await adminRescheduleBooking({
      bookingId: id,
      newDate: data.newDate,
      newStartTime: data.newStartTime,
      newEndTime: data.newEndTime,
      reason: data.reason,
      actorId: admin.id,
      actorName: admin.name,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        status: 'rescheduled',
        previousStatus: result.previousStatus,
        newBookingId: result.newBookingId,
        newReference: result.newReference,
      });
    }

    const status = result.error === 'Booking not found' ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
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
