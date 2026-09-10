import { inngest } from '../client';
import { processEmailEvent } from '@/lib/email/events';
import { eq, and, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { emailEvents } from '@/lib/db/schema';

/**
 * Inngest functions for email handling.
 *
 * Replaces the direct sendEmail() calls and cron-based retry logic.
 * Booking/confirmation logic emits events; Inngest functions react to them
 * with automatic retry and step-level replay.
 *
 * NOTE: Using 'any' types to work around Inngest v4 type system quirks.
 * The API is correct at runtime.
 */

export const sendEmailFn = inngest.createFunction({
  id: 'send-email',
  name: 'Send Email',
}, async (args: any) => {
  const event = args.event;
  const step = args.step;

  const eventId = event.data.eventId;

  return await step.run(`process-email-${eventId}`, async () => {
    const success = await processEmailEvent(eventId);
    return { success, eventId };
  });
});

export const processDueEmailsFn = inngest.createFunction({
  id: 'process-due-emails',
  name: 'Process Due Emails',
}, async (args: any) => {
  const step = args.step;

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
});

export const sweepDeadLetterEmailFn = inngest.createFunction({
  id: 'sweep-dead-letter-emails',
  name: 'Sweep Dead Letter Emails',
}, async (args: any) => {
  const step = args.step;

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
});
