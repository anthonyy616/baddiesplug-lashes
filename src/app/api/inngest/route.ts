import { serve } from 'inngest/next';
import {
  inngest,
  sendEmailFn,
  processDueEmailsFn,
  sweepDeadLetterEmailFn,
  queueRemindersFn,
  markNoShowsFn,
  cleanupExpiredImagesFn,
} from '@/inngest';

/**
 * Inngest Next.js route handler.
 *
 * This serves all Inngest functions at /api/inngest.
 * Inngest will call this endpoint to trigger functions and handle retries.
 *
 * Requires INNGEST_SIGNING_KEY to be set in environment variables.
 */

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Email handling
    sendEmailFn,
    processDueEmailsFn,
    sweepDeadLetterEmailFn,

    // Reminders
    queueRemindersFn,

    // No-show marking
    markNoShowsFn,

    // Cleanup
    cleanupExpiredImagesFn,
  ],
});
