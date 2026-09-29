import { db } from '@/lib/db';
import { bookings, bookingServices, bookingAddons, notifications, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { BookingStatus } from '@/types';
import { isReschedulable } from '@/lib/booking/lifecycle';
import { recordBookingEvent } from '@/lib/booking/audit';
import { validateAdminSlot, invalidateAvailabilityCache } from '@/lib/availability';
import { generateBookingReference } from '@/lib/pricing';
import { cancelPendingReminders } from '@/lib/jobs';
import { queueEmailEvent } from '@/lib/email/events';
import { isUniqueViolation } from './slot-errors';

/**
 * RESCHEDULING SYSTEM V2 (Stage 4).
 *
 * Admin-controlled rescheduling as a first-class booking command. This module
 * is the single authoritative implementation — the admin bookings API, and
 * any future admin surface (e.g. the calendar), must go through this command
 * rather than hand-rolling booking mutations.
 *
 * Policy:
 * - Eligibility is defined explicitly by isReschedulable() in the shared
 *   lifecycle module ('confirmed' and 'approved'; 'pending' is NOT
 *   reschedulable — admins reject/cancel those instead).
 * - The new slot is validated BEFORE the original booking is touched
 *   (validateAdminSlot: business hours, overlap, blocked overrides) and the
 *   database partial unique index remains the final race guard.
 * - Transactional: the original booking is guarded-cancelled and the
 *   replacement created in ONE transaction — a failure rolls everything back
 *   so the original is never left cancelled without a replacement.
 * - Approval state carries over: approved -> approved, confirmed -> confirmed.
 * - Snapshots and historical totals are copied unchanged (no repricing).
 * - Both records stay linked (previousBookingId + booking_event rows) so
 *   repeated reschedules remain traceable: A -> B -> C.
 * - A customer-safe reschedule reason is recorded in the audit trail and
 *   passed to the durable confirmation email.
 * - The durable email event is queued inside the transaction; a later email
 *   failure can never corrupt the booking data (dispatch happens after
 *   commit and retries via the email-event worker).
 */

/** Thrown when the guarded cancel affects 0 rows — a racing action won. Maps to 409. */
export class ConcurrencyConflictError extends Error {
  constructor() {
    super('Booking was modified concurrently');
    this.name = 'ConcurrencyConflictError';
  }
}

/** Thrown when the requested slot fails validation. Maps to 400. */
export class SlotValidationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SlotValidationError';
  }
}

export interface AdminRescheduleInput {
  bookingId: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  /** Customer-safe reason shown in the audit trail and the confirmation email. */
  reason?: string;
  /** Admin actor (panel session id/name or users.id). */
  actorId?: string | null;
  actorName?: string;
}

export interface AdminRescheduleResult {
  success: boolean;
  error?: string;
  newBookingId?: string;
  newReference?: string;
  previousStatus?: string;
}

/**
 * Reschedule a booking: atomically cancel the original and create a linked
 * replacement that passes all normal availability rules.
 */
export async function adminRescheduleBooking(
  input: AdminRescheduleInput
): Promise<AdminRescheduleResult> {
  const { bookingId, newDate, newStartTime, newEndTime } = input;
  const reason = input.reason?.trim() || undefined;

  try {
    // Time format validation up-front (admin custom times are allowed, but
    // must be well-formed; business rules checked by the admin slot validator).
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newStartTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(newEndTime)) {
      return { success: false, error: 'Invalid time format' };
    }
    if (newStartTime >= newEndTime) {
      return { success: false, error: 'End time must be after start time' };
    }

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Explicit eligibility (shared lifecycle policy): confirmed/approved only.
    if (!isReschedulable(booking.status)) {
      return { success: false, error: `Cannot reschedule a ${booking.status} booking` };
    }

    // Validate the new slot BEFORE mutating the original. Admin custom times
    // are allowed (business-hours/overlap/override checks inside); the booking
    // being moved is excluded from the overlap check.
    const slotValidation = await validateAdminSlot(newDate, newStartTime, newEndTime, bookingId);
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
      // validated against. 0 rows = a racing admin action won.
      const cancelledOld = await tx
        .update(bookings)
        .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, booking.status)))
        .returning({ id: bookings.id });

      if (cancelledOld.length === 0) {
        throw new ConcurrencyConflictError();
      }

      // Suppress reminders queued for the original slot.
      await cancelPendingReminders(bookingId);

      // Snapshots copied BEFORE creating the replacement.
      const oldServices = await tx.query.bookingServices.findMany({
        where: eq(bookingServices.bookingId, bookingId),
      });
      const oldAddons = await tx.query.bookingAddons.findMany({
        where: eq(bookingAddons.bookingId, bookingId),
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
        previousBookingId: bookingId,
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

      // Audit: original records the reschedule outcome + link to replacement.
      await recordBookingEvent(
        {
          bookingId,
          eventType: 'rescheduled',
          actorType: 'admin',
          actorId: input.actorId ?? null,
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
            ...(reason ? { reason } : {}),
            ...(input.actorName ? { adminActor: input.actorName } : {}),
          },
        },
        tx,
      );
      // Audit: replacement records its creation-by-reschedule + link back.
      await recordBookingEvent(
        {
          bookingId: newBookingId,
          eventType: 'created',
          actorType: 'admin',
          actorId: input.actorId ?? null,
          relatedBookingId: bookingId,
          metadata: {
            reference: newReference,
            rescheduledFrom: booking.reference,
            wasApproved: replacementStatus === 'approved',
            ...(reason ? { reason } : {}),
          },
        },
        tx,
      );

      // Admin action notification (shows in admin list).
      await tx.insert(notifications).values({
        id: uuidv4(),
        type: 'booking_rescheduled',
        bookingId,
        customerId: booking.customerId,
        title: 'Booking Rescheduled',
        message: `Booking ${booking.reference} was rescheduled by admin to ${newReference}`,
        isRead: false,
        createdAt: now,
      });

      // Customer notification with old AND new appointment details.
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
      // appointment data plus approval/payment carry-over state. Queued
      // inside the transaction; dispatch + retries happen after commit.
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
            ...(reason ? { reason } : {}),
          },
        },
        tx,
      );
    });

    // Dispatch after commit — both the old and new booking ids carry events.
    const { getDispatchableEventIds, dispatchEmailEvent } = await import('@/lib/email/events');
    const eventIds = [
      ...(await getDispatchableEventIds(bookingId)),
      ...(await getDispatchableEventIds(newBookingId)),
    ];
    for (const eventId of eventIds) {
      dispatchEmailEvent(eventId);
    }

    // Old slot released, new slot taken — both dates must re-read the DB.
    invalidateAvailabilityCache(booking.appointmentDate);
    invalidateAvailabilityCache(newDate);

    return {
      success: true,
      previousStatus: booking.status,
      newBookingId,
      newReference,
    };
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      throw error;
    }
    if (error instanceof SlotValidationError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new SlotValidationError('overlaps_existing_booking');
    }
    console.error('Error rescheduling booking:', error);
    return { success: false, error: 'Failed to reschedule booking' };
  }
}
