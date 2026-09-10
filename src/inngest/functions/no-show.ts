import { inngest } from '../client';
import { db } from '@/lib/db';
import { bookings } from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { parseSlotToDateTime } from '@/lib/timezone';

/**
 * Inngest function for marking no-shows.
 *
 * Replaces the polling-based markNoShows() cron job.
 */

export const markNoShowsFn = inngest.createFunction({
  id: 'mark-no-shows',
  name: 'Mark No Shows',
}, async (args: any) => {
  const step = args.step;

  // Get confirmed bookings from the last 7 days
  const candidates = await step.run('fetch-candidates', async () => {
    return await db.query.bookings.findMany({
      where: and(
        eq(bookings.status, 'confirmed'),
        sql`${bookings.appointmentDate} >= to_char(now() - interval '7 days', 'YYYY-MM-DD')`
      ),
    });
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

  if (toMark.length === 0) {
    return { marked: 0, totalCandidates: candidates.length };
  }

  const result = await step.run('mark-no-shows', async () => {
    await db
      .update(bookings)
      .set({ status: 'no_show', updatedAt: now })
      .where(inArray(bookings.id, toMark));

    return toMark.length;
  });

  return { marked: result, totalCandidates: candidates.length };
});
