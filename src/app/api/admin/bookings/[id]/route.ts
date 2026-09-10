import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { bookings, notifications, emailEvents, users, bookingServices, bookingAddons } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '@/lib/auth/types';
import { queueEmailEvent, dispatchEmailEvent } from '@/lib/email/events';
import { getBookingById } from '@/lib/booking';
import { isSlotAvailable } from '@/lib/availability';
import { generateBookingReference } from '@/lib/pricing';

// Valid transitions:
//   pending   -> confirmed | rejected | cancelled   (existing pending bookings)
//   confirmed -> completed | no_show | cancelled | rescheduled (new confirmed booking)
// Auto-approval means new bookings are created as 'confirmed', so there is no
// pending -> approve path for new bookings; approve/reject remain for any
// pre-existing pending bookings.
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

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  approve: ['pending'],
  reject: ['pending'],
  cancel: ['pending', 'confirmed'],
  complete: ['confirmed'],
  no_show: ['confirmed'],
  reschedule: ['confirmed'],
};

const TARGET_STATUS: Record<string, string> = {
  approve: 'confirmed',
  reject: 'rejected',
  cancel: 'cancelled',
  complete: 'completed',
  no_show: 'no_show',
};

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
    const targetStatus = TARGET_STATUS[action];

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (!ALLOWED_TRANSITIONS[action].includes(booking.status)) {
      return NextResponse.json(
        { error: `Cannot ${action} a ${booking.status} booking` },
        { status: 400 }
      );
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      const updateValues: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: now,
      };
      if (targetStatus === 'cancelled') updateValues.cancelledAt = now;
      if (targetStatus === 'completed') updateValues.completedAt = now;

      await tx.update(bookings).set(updateValues).where(eq(bookings.id, id));      await tx.insert(notifications).values({
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

      // No rejection email is required per requirements; others get emails.
      if (action !== 'reject') {
        const eventType =
          action === 'approve'
            ? 'booking.confirmed'
            : action === 'cancel'
              ? 'booking.admin_cancelled'
              : action === 'reschedule'
                ? 'booking.rescheduled'
                : null;

        if (eventType && action !== 'reschedule') {
          const customer = await tx.query.users.findFirst({
            where: eq(users.id, booking.customerId),
          });

          await queueEmailEvent({
            eventType,
            recipient: customer?.email || '',
            bookingId: id,
            payload: {
              customerName: customer?.name || 'Customer',
              reference: booking.reference,
              date: booking.appointmentDate,
              startTime: booking.startTime,
              endTime: booking.endTime,
            },
          });
        }

        // Reschedule: cancel old booking, create new confirmed booking
        if (action === 'reschedule') {
          const newDate = parsed.data.newDate!;
          const newStartTime = parsed.data.newStartTime!;
          const newEndTime = parsed.data.newEndTime!;

          // Validate new slot
          const slotValidation = await isSlotAvailable(newDate, newStartTime, newEndTime);
          if (!slotValidation.available) {
            throw new Error(`Reschedule slot not available: ${slotValidation.reason || 'unavailable'}`);
          }

          const newBookingId = uuidv4();
          const newReference = generateBookingReference();
          const rescheduleNow = new Date();

          // Cancel the old booking
          await tx
            .update(bookings)
            .set({ status: 'cancelled', cancelledAt: rescheduleNow, updatedAt: rescheduleNow })
            .where(eq(bookings.id, id));

          // Copy service/addon snapshots from old booking
          const oldServices = await tx.query.bookingServices.findMany({
            where: eq(bookingServices.bookingId, id),
          });
          const oldAddons = await tx.query.bookingAddons.findMany({
            where: eq(bookingAddons.bookingId, id),
          });

          // Create new confirmed booking referencing the old one
          await tx.insert(bookings).values({
            id: newBookingId,
            reference: newReference,
            customerId: booking.customerId,
            appointmentDate: newDate,
            startTime: newStartTime,
            endTime: newEndTime,
            status: 'confirmed',
            phone: booking.phone,
            customerNotes: booking.customerNotes,
            subtotal: booking.subtotal,
            depositRequired: booking.depositRequired,
            total: booking.total,
            previousBookingId: id,
            createdAt: rescheduleNow,
            updatedAt: rescheduleNow,
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

          // Admin action notification (booking_rescheduled with customerId — shows in admin list)
          await tx.insert(notifications).values({
            id: uuidv4(),
            type: 'booking_rescheduled',
            bookingId: id,
            customerId: booking.customerId,
            title: 'Booking Rescheduled',
            message: `Booking ${booking.reference} was rescheduled by admin to ${newReference}`,
            isRead: false,
            createdAt: rescheduleNow,
          });

          // Customer notification (customer_booking_rescheduled — without customerId in type for filtering)
          const customer = await tx.query.users.findFirst({
            where: eq(users.id, booking.customerId),
          });

          await tx.insert(notifications).values({
            id: uuidv4(),
            type: 'customer_booking_rescheduled',
            bookingId: newBookingId,
            customerId: booking.customerId,
            title: 'Booking Rescheduled',
            message: `Your booking ${booking.reference} has been rescheduled to ${newDate} ${newStartTime} (ref ${newReference})`,
            isRead: false,
            createdAt: rescheduleNow,
          });

          // Queue reschedule email to customer
          await queueEmailEvent({
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
              services: oldServices.map((s) => s.serviceNameSnapshot),
            },
          });

          // Return new booking info via a response extension (set on the request for after-transaction pickup)
          (request as any)._rescheduleResult = { newBookingId, newReference };
        }
      }
    });

    // Best-effort async dispatch
    const queued = await db
      .select({ id: emailEvents.id })
      .from(emailEvents)
      .where(eq(emailEvents.bookingId, id));
    for (const event of queued) {
      dispatchEmailEvent(event.id);
    }

    void admin;

    const rescheduleResult = (request as any)._rescheduleResult as { newBookingId: string; newReference: string } | undefined;

    if (rescheduleResult) {
      return NextResponse.json({
        success: true,
        status: 'cancelled',
        newBookingId: rescheduleResult.newBookingId,
        newReference: rescheduleResult.newReference,
      });
    }

    return NextResponse.json({ success: true, status: targetStatus });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin booking action error:', error);
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
