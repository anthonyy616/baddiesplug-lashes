import { NextRequest, NextResponse } from 'next/server';
import {
  queueAppointmentReminders,
  sendDueReminders,
  markNoShows,
  cleanupExpiredReferenceImages,
  retryEmails,
} from '@/lib/jobs';

/**
 * Protected cron entry point.
 *
 * Vercel Cron sends the secret automatically as an Authorization header;
 * external schedulers can use ?key= or Bearer.
 *
 * This route is the scheduler for reminders, email retries, no-show updates,
 * and expired reference-image cleanup.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) return true;

  const key = request.nextUrl.searchParams.get('key');
  return key === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, number> = {};
  const errors: string[] = [];

  // Each job is independent — one failing must not block the others
  const jobs: [string, () => Promise<number>][] = [
    ['remindersQueued', queueAppointmentReminders],
    ['remindersSent', sendDueReminders],
    ['noShowsMarked', markNoShows],
    ['imagesDeleted', cleanupExpiredReferenceImages],
    ['emailsRetried', retryEmails],
  ];

  for (const [name, job] of jobs) {
    try {
      results[name] = await job();
    } catch (error) {
      console.error(`Job ${name} failed:`, error);
      errors.push(name);
      results[name] = -1;
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    ranAt: new Date().toISOString(),
    results,
    failedJobs: errors,
  });
}
