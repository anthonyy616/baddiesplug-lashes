import { db } from '@/lib/db';
import {
  bookings,
  users,
  emailEvents,
  referenceImages,
  bookingServices,
} from '@/lib/db/schema';
import { eq, and, inArray, lte, sql } from 'drizzle-orm';
import { queueEmailEvent, dispatchEmailEvent, retryPendingEmails } from '@/lib/email/events';
import { parseSlotToDateTime } from '@/lib/timezone';

/**
 * Scheduled jobs. All are idempotent and safe to run on a schedule.
 */

/**
 * Queue 1-hour-before reminders for confirmed bookings that don't have one
 * yet. Runs every 5 minutes; creates reminder email events scheduled for
 * exactly 1 hour before the appointment start.
 * Returns the number of reminders queued.
 */
export async function queueAppointmentReminders(): Promise<number> {
  // Confirmed appointments starting within the next ~90 minutes without a
  // reminder event already queued.
  const now = Date.now();
  const horizon = new Date(now + 90 * 60 * 1000);

  const upcoming = await db.query.bookings.findMany({
    where: and(
      eq(bookings.status, 'confirmed'),
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
 * Send all reminders that are due now (scheduledFor <= now).
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
        lte(emailEvents.scheduledFor, new Date())
      )
    )
    .limit(50);

  for (const event of due) {
    dispatchEmailEvent(event.id);
  }

  return due.length;
}

/**
 * Mark confirmed bookings whose end time has passed as no_show.
 * Per requirements this is admin-only information; customers are never
 * notified. Admin can correct the status manually afterwards.
 * Returns number transitioned.
 */
export async function markNoShows(): Promise<number> {
  const candidates = await db.query.bookings.findMany({
    where: and(
      eq(bookings.status, 'confirmed'),
      sql`${bookings.appointmentDate} >= to_char(now() - interval '7 days', 'YYYY-MM-DD')`
    ),
  });

  const now = new Date();
  const toMark: string[] = [];

  for (const booking of candidates) {
    try {
      const { end } = parseSlotToDateTime({
        date: booking.appointmentDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });
      if (end < now) {
        toMark.push(booking.id);
      }
    } catch {
      continue;
    }
  }

  if (toMark.length === 0) return 0;

  await db
    .update(bookings)
    .set({ status: 'no_show', updatedAt: now })
    .where(inArray(bookings.id, toMark));

  return toMark.length;
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
