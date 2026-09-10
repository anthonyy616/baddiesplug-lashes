import { inngest } from '../client';
import { processEmailEvent, retryPendingEmails } from '@/lib/email/events';
import { eq, and, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { emailEvents } from '@/lib/db/schema';

/**
 * Inngest functions for email handling.
 *
 * Replaces the direct sendEmail() calls and cron-based retry logic.
 * Booking/confirmation logic emits events; Inngest functions react to them
 * with automatic retry and step-level replay.
 */

/**
 * Send an individual email event.
 *
 * Wrapped in step.run() so each email gets its own retry with exponential
 * backoff. If this fails, Inngest retries automatically; if it succeeds,
 * the event status is updated to 'sent'.
 */
export const sendEmailFn = inngest.function(
  'send-email',
  async ({ event, step }) => {
    const eventId = event.data.eventId;

    return await step.run(`process-email-${eventId}`, async () => {
      const success = await processEmailEvent(eventId);
      return { success, eventId };
    });
  }
);

/**
 * Process all due pending emails.
 *
 * This is a scheduled function (runs on cron) that handles the catch-up
 * pattern for emails that didn't get sent via the event-driven path.
 * Each email is wrapped in step.run() for individual retry.
 */
export const processDueEmailsFn = inngest.function(
  'process-due-emails',
  async ({ step }) => {
    const due = await db
      .select({ id: emailEvents.id })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.status, 'pending'),
          lte(emailEvents.scheduledFor, new Date()),
          sql`${emailEvents.attempts} < 5`
        )
      )
      .limit(50);

    let processed = 0;

    for (const event of due) {
      await step.run(`process-${event.id}`, async () => {
        const success = await processEmailEvent(event.id);
        if (success) processed++;
      });
    }

    return { processed, totalDue: due.length };
  }
);

/**
 * Safety-net sweep for emails that exhausted Inngest retries.
 *
 * Moves them to a genuine dead-letter state for manual review.
 * Runs less frequently than the main processor.
 */
export const sweepDeadLetterEmailFn = inngest.function(
  'sweep-dead-letter-emails',
  async ({ step }) => {
    // Find events that have been retried many times but never sent
    const deadLetter = await db
      .select({ id: emailEvents.id })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.status, 'pending'),
          sql`${emailEvents.attempts} >= 10`
        )
      )
      .limit(100);

    let movedToDeadLetter = 0;

    for (const event of deadLetter) {
      await step.run(`mark-dead-${event.id}`, async () => {
        await db
          .update(emailEvents)
          .set({
            status: 'dead_letter',
            lastError: 'Exhausted all retry attempts',
          })
          .where(eq(emailEvents.id, event.id));
        movedToDeadLetter++;
      });
    }

    return { movedToDeadLetter, totalFound: deadLetter.length };
  }
);
