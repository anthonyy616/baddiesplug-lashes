import { inngest } from '../client';
import { db } from '@/lib/db';
import { bookings, users, emailEvents, bookingServices } from '@/lib/db/schema';
import { eq, and, sql, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { queueEmailEvent } from '@/lib/email/events';
import { parseSlotToDateTime } from '@/lib/timezone';

/**
 * Inngest function for appointment reminders.
 *
 * Replaces the polling-based queueAppointmentReminders() cron job.
 * Instead of polling every day, this:
 * 1. Runs on a schedule (daily) to catch any bookings created since last run
 * 2. OR could be triggered directly by booking.confirmed event with a delayed step
 */

/**
 * Queue reminders for confirmed bookings.
 *
 * Scheduled function (same cadence as before: daily via Vercel Cron or
 * Inngest's built-in scheduling). Handles the catch-up pattern for
 * bookings that were confirmed since the last run.
 */
export const queueRemindersFn = inngest.function(
  'queue-reminders',
  async ({ step }) => {
    const now = Date.now();
    const horizon = new Date(now + 32 * 60 * 60 * 1000); // 32 hours

    // Get confirmed bookings starting within the horizon
    const upcoming = await step.run('fetch-upcoming-bookings', async () => {
      return await db.query.bookings.findMany({
        where: and(
          eq(bookings.status, 'confirmed'),
          sql`${bookings.appointmentDate} >= to_char(now() - interval '1 day', 'YYYY-MM-DD')`
        ),
      });
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

      // Check if reminder already exists
      const existing = await step.run(`check-reminder-${booking.id}`, async () => {
        return await db.query.emailEvents.findFirst({
          where: and(
            eq(emailEvents.bookingId, booking.id),
            eq(emailEvents.eventType, 'appointment.reminder')
          ),
        });
      });

      if (existing) continue;

      const customer = await step.run(`fetch-customer-${booking.id}`, async () => {
        return await db.query.users.findFirst({
          where: eq(users.id, booking.customerId),
        });
      });

      if (!customer) continue;

      const services = await step.run(`fetch-services-${booking.id}`, async () => {
        return await db.query.bookingServices.findMany({
          where: eq(bookingServices.bookingId, booking.id),
        });
      });

      const reminderFor = new Date(start.getTime() - 60 * 60 * 1000);

      await step.run(`queue-reminder-${booking.id}`, async () => {
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
            services: services.map((s) => s.serviceNameSnapshot),
          },
        });
      });

      queued++;
    }

    return { queued, totalProcessed: upcoming.length };
  }
);
