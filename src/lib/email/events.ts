import { db } from '@/lib/db';
import { emailEvents } from '@/lib/db/schema';
import { eq, and, inArray, lte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { EmailEventType } from '@/types';
import {
  generateBookingRequestEmail,
  generateBookingConfirmationEmail,
  generateCancellationEmail,
  generateAppointmentReminderEmail,
  generateBookingRescheduledEmail,
} from './templates';
import { sendEmail } from './send';

/**
 * Durable, retryable email events.
 *
 * Email failures must never roll back a booking transaction. We persist an
 * email_events row (inside the booking transaction where applicable) and
 * dispatch asynchronously; failed events are retried by the cron job.
 */

const MAX_ATTEMPTS = 5;

export interface QueueEmailInput {
  eventType: EmailEventType;
  recipient: string;
  bookingId?: string;
  scheduledFor?: Date;
  payload: Record<string, unknown>;
}

/** Persist an email event. Safe to call inside a booking transaction. */
export async function queueEmailEvent(input: QueueEmailInput): Promise<void> {
  await db.insert(emailEvents).values({
    id: uuidv4(),
    eventType: input.eventType,
    bookingId: input.bookingId ?? null,
    recipient: input.recipient,
    payload: JSON.stringify(input.payload),
    status: 'pending',
    attempts: 0,
    scheduledFor: input.scheduledFor ?? new Date(),
  });
}

/**
 * Try to send a single pending email event.
 * Returns true when sent (or permanently skipped); false when it should be retried.
 */
export async function processEmailEvent(eventId: string): Promise<boolean> {
  const event = await db.query.emailEvents.findFirst({
    where: eq(emailEvents.id, eventId),
  });

  if (!event) return true;
  if (event.status === 'sent') return true;
  if (event.attempts >= MAX_ATTEMPTS) {
    await db
      .update(emailEvents)
      .set({ status: 'failed', lastError: 'Max attempts exceeded' })
      .where(eq(emailEvents.id, eventId));
    return true;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.payload);
  } catch {
    await db
      .update(emailEvents)
      .set({ status: 'failed', lastError: 'Unparseable payload' })
      .where(eq(emailEvents.id, eventId));
    return true;
  }

  const html = renderEmailHtml(event.eventType as EmailEventType, payload);

  try {
    const result = await sendEmail({
      to: event.recipient,
      subject: emailSubject(event.eventType as EmailEventType, payload),
      html,
    });

    if (result.success) {
      await db
        .update(emailEvents)
        .set({ status: 'sent', sentAt: new Date(), lastError: null })
        .where(eq(emailEvents.id, eventId));
      return true;
    }

    throw new Error(result.error || 'Send failed');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const attempts = event.attempts + 1;
    await db
      .update(emailEvents)
      .set({
        attempts,
        lastError: message.slice(0, 1000),
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
      })
      .where(eq(emailEvents.id, eventId));
    return false;
  }
}

/** Fire-and-forget dispatch: never throws, never blocks the caller. */
export function dispatchEmailEvent(eventId: string): void {
  void processEmailEvent(eventId).catch((error) => {
    console.error('Email dispatch error:', error);
  });
}

/** Retry all due pending events (cron entry point). Returns processed count. */
export async function retryPendingEmails(limit = 20): Promise<number> {
  const due = await db
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.status, 'pending'),
        lte(emailEvents.scheduledFor, new Date()),
        sql`${emailEvents.attempts} < ${MAX_ATTEMPTS}`
      )
    )
    .limit(limit);

  for (const event of due) {
    await processEmailEvent(event.id);
  }

  return due.length;
}

function emailSubject(eventType: EmailEventType, payload: Record<string, unknown>): string {
  const reference = String(payload.reference ?? '');
  switch (eventType) {
    case 'booking.requested':
      return `Booking request received — ${reference}`;
    case 'booking.confirmed':
      return `Booking confirmed — ${reference}`;
    case 'booking.customer_cancelled':
      return `Booking cancelled — ${reference}`;
    case 'booking.admin_cancelled':
      return `Booking cancelled — ${reference}`;
    case 'booking.rescheduled':
      return `Booking rescheduled — ${reference}`;
    case 'appointment.reminder':
      return `Appointment reminder — ${reference}`;
    default:
      return `Booking update — ${reference}`;
  }
}

function renderEmailHtml(eventType: EmailEventType, payload: Record<string, unknown>): string {
  // Payload fields are rendered through the template functions; string values
  // originate from our own database records, not raw user HTML.
  const str = (key: string): string => String(payload[key] ?? '');
  const arr = (key: string): string[] =>
    Array.isArray(payload[key]) ? (payload[key] as string[]).map(String) : [];

  switch (eventType) {
    case 'booking.requested':
      return generateBookingRequestEmail({
        customerName: str('customerName'),
        reference: str('reference'),
        date: str('date'),
        startTime: str('startTime'),
        endTime: str('endTime'),
        services: arr('services'),
        addons: arr('addons'),
        total: Number(payload.total ?? 0),
        depositRequired: Number(payload.depositRequired ?? 0),
        phone: str('phone'),
        notes: payload.notes ? str('notes') : undefined,
      });
    case 'booking.confirmed':
      return generateBookingConfirmationEmail({
        customerName: str('customerName'),
        reference: str('reference'),
        date: str('date'),
        startTime: str('startTime'),
        endTime: str('endTime'),
        services: arr('services'),
        addons: arr('addons'),
        total: Number(payload.total ?? 0),
        depositRequired: Number(payload.depositRequired ?? 0),
      });
    case 'booking.customer_cancelled':
    case 'booking.admin_cancelled':
      return generateCancellationEmail({
        customerName: str('customerName'),
        reference: str('reference'),
        date: str('date'),
        startTime: str('startTime'),
        endTime: str('endTime'),
        cancelledBy: eventType === 'booking.admin_cancelled' ? 'admin' : 'customer',
      });
    case 'booking.rescheduled':
      return generateBookingRescheduledEmail({
        customerName: str('customerName'),
        reference: str('reference'),
        previousReference: str('previousReference'),
        date: str('date'),
        startTime: str('startTime'),
        endTime: str('endTime'),
        services: arr('services'),
      });
    case 'appointment.reminder':
      return generateAppointmentReminderEmail({
        customerName: str('customerName'),
        reference: str('reference'),
        date: str('date'),
        startTime: str('startTime'),
        endTime: str('endTime'),
        services: arr('services'),
      });
    default:
      return `<p>Booking update for ${str('reference')}.</p>`;
  }
}

export { inArray };
