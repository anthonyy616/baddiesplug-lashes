import { db } from '@/lib/db';
import {
  bookings,
  users,
  emailEvents,
  referenceImages,
  bookingServices,
} from '@/lib/db/schema';
import { eq, and, inArray, lte, sql } from 'drizzle-orm';
import { queueEmailEvent, processEmailEvent, retryPendingEmails } from '@/lib/email/events';
import { parseSlotToDateTime } from '@/lib/timezone';

/**
 * Scheduled jobs. All are idempotent and safe to run on a schedule.
 */

/**
 * Queue 1-hour-before reminders for confirmed bookings that don't have one
 * yet. The cron runs once daily (Vercel Hobby plan), so this queues reminders
 * for every confirmed appointment starting within the next ~32 hours — i.e.
 * everything that will come due before the next daily run.
 * Reminder events are still scheduled for exactly 1 hour before the
 * appointment start (used for audit and by other senders).
 * Returns the number of reminders queued.
 */
export async function queueAppointmentReminders(): Promise<number> {
  // Confirmed appointments starting within the next ~32 hours without a
  // reminder event already queued.
  const now = Date.now();
  const horizon = new Date(now + 32 * 60 * 60 * 1000);

  // Approved appointments get reminders too (audit item 10): selection
  // includes BOTH 'confirmed' and 'approved'.
  const upcoming = await db.query.bookings.findMany({
    where: and(
      inArray(bookings.status, ['confirmed', 'approved']),
      sql`${bookings.appointmentDate} >= to_char(now() - interval '1 day', 'YYYY-MM-DD')`
    ),
  });

  let queued = 0;

  for (const booking of upcoming) {
    let start: Date;
    try {
      start = parseSlotToDateTime({
        date: booking.appointmentDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
      }).start;
    } catch {
      continue;
    }

    if (start > horizon || start < new Date(now)) continue;

    // Skip if a reminder event already exists for this booking
    const existing = await db.query.emailEvents.findFirst({
      where: and(
        eq(emailEvents.bookingId, booking.id),
        eq(emailEvents.eventType, 'appointment.reminder')
      ),
    });
    if (existing) continue;

    const customer = await db.query.users.findFirst({
      where: eq(users.id, booking.customerId),
    });
    if (!customer) continue;

    const bookingServicesRows = await db.query.bookingServices.findMany({
      where: eq(bookingServices.bookingId, booking.id),
    });

    const reminderFor = new Date(start.getTime() - 60 * 60 * 1000);

    await queueEmailEvent({
      eventType: 'appointment.reminder',
      recipient: customer.email,
      bookingId: booking.id,
      scheduledFor: reminderFor,
      payload: {
        customerName: customer.name,
        reference: booking.reference,
        date: booking.appointmentDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        services: bookingServicesRows.map((s) => s.serviceNameSnapshot),
      },
    });
    queued++;
  }

  return queued;
}

/**
 * Send all reminders that are due now or before the next daily run.
 *
 * With a once-daily cron (Vercel Hobby plan), waiting for scheduledFor <= now
 * would fire most same-day reminders AFTER the appointment. Instead we send
 * everything that becomes due within the next 24 hours — the standard
 * catch-up pattern for low-frequency schedulers. Each reminder is still sent
 * exactly once (status flips to 'sent').
 * Returns number sent.
 */
export async function sendDueReminders(): Promise<number> {
  const due = await db
    .select({ id: emailEvents.id, bookingId: emailEvents.bookingId })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.eventType, 'appointment.reminder'),
        eq(emailEvents.status, 'pending'),
        lte(emailEvents.scheduledFor, new Date(Date.now() + 24 * 60 * 60 * 1000))
      )
    )
    .limit(50);

  // Re-check the booking status immediately before sending (audit item 10):
  // a reminder for a booking cancelled/rescheduled after queueing must not
  // go out. Cancelled/terminal/reschedule-source bookings suppress the send
  // by failing the event permanently.
  const TERMINAL_OR_CANCELLED = [
    'cancelled',
    'rejected',
    'ignored',
    'completed',
    'no_show',
  ];

  let sent = 0;
  for (const event of due) {
    if (event.bookingId) {
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, event.bookingId),
      });
      if (!booking || TERMINAL_OR_CANCELLED.includes(booking.status)) {
        // Booking gone or cancelled — permanently suppress this reminder.
        await db
          .update(emailEvents)
          .set({ status: 'failed', lastError: 'Booking cancelled or removed before reminder' })
          .where(eq(emailEvents.id, event.id));
        continue;
      }
    }

    // Await each send so the serverless function doesn't freeze mid-flight
    // after the cron response returns. processEmailEvent never throws.
    await processEmailEvent(event.id);
    sent++;
  }

  return sent;
}

/**
 * Cancel pending reminders for a booking (called when a booking is cancelled
 * or rescheduled so stale reminders never fire for the old slot).
 */
export async function cancelPendingReminders(bookingId: string): Promise<number> {
  const cancelled = await db
    .update(emailEvents)
    .set({ status: 'failed', lastError: 'Booking cancelled or rescheduled' })
    .where(
      and(
        eq(emailEvents.bookingId, bookingId),
        eq(emailEvents.eventType, 'appointment.reminder'),
        eq(emailEvents.status, 'pending'),
      ),
    )
    .returning({ id: emailEvents.id });
  return cancelled.length;
}

/**
 * Move untouched, past 'confirmed' bookings to 'ignored'.
 *
 * Per the lifecycle plan, the scheduled job must NEVER create 'no_show' —
 * that is a manual admin outcome. Instead, bookings the admin never touched
 * (still plain 'confirmed' after their end time passed) are auto-marked
 * 'ignored': they remain visible in admin history, are hidden from customers,
 * and release their time slot.
 *
 * Idempotent: only rows still in 'confirmed' are updated, so manually
 * approved or manually no-show'd bookings are never overwritten, and re-runs
 * process nothing.
 * Returns number transitioned.
 */
export async function markIgnoredBookings(): Promise<number> {
  const candidates = await db.query.bookings.findMany({
    where: and(
      eq(bookings.status, 'confirmed'),
      sql`${bookings.appointmentDate} >= to_char(now() - interval '7 days', 'YYYY-MM-DD')`
    ),
  });

  const now = new Date();
  const toIgnore: string[] = [];

  for (const booking of candidates) {
    try {
      const { end } = parseSlotToDateTime({
        date: booking.appointmentDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });
      if (end < now) {
        toIgnore.push(booking.id);
      }
    } catch {
      continue;
    }
  }

  if (toIgnore.length === 0) return 0;

  // Race safety: re-check status = 'confirmed' in the WHERE clause so an
  // admin approval landing between the SELECT and this UPDATE is never
  // overwritten to 'ignored'. Only rows still confirmed are transitioned.
  const ignored = await db
    .update(bookings)
    .set({ status: 'ignored', updatedAt: now })
    .where(and(inArray(bookings.id, toIgnore), eq(bookings.status, 'confirmed')))
    .returning({ id: bookings.id });

  return ignored.length;
}

/**
 * Delete expired reference images: remove R2 objects and their DB rows.
 * Retention is 1 month (expiresAt). Returns number deleted.
 */
export async function cleanupExpiredReferenceImages(): Promise<number> {
  const expired = await db.query.referenceImages.findMany({
    where: lte(referenceImages.expiresAt, new Date()),
    limit: 100,
  });

  if (expired.length === 0) return 0;

  const { deleteFromR2 } = await import('@/lib/storage');

  let deleted = 0;
  for (const image of expired) {
    const result = await deleteFromR2(image.storageKey);
    if (result.success) {
      await db.delete(referenceImages).where(eq(referenceImages.id, image.id));
      deleted++;
    }
  }

  return deleted;
}

/**
 * Retry failed/due email events. Thin wrapper over the email module.
 */
export async function retryEmails(): Promise<number> {
  return retryPendingEmails(20);
}
