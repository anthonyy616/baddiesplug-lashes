import { db } from '@/lib/db';
import type { TxLike } from '@/lib/db/tx';
import { emailEvents } from '@/lib/db/schema';
import { eq, and, lte, sql, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { EmailEventType } from '@/types';
import { validateEmailPayload } from './payloads';
import {
  generateBookingRequestEmail,
  generateBookingConfirmationEmail,
  generateAdminBookingEmail,
  generateCancellationEmail,
  generateAppointmentReminderEmail,
  generateBookingRescheduledEmail,
} from './templates';
import { sendEmail } from './send';

/**
 * Durable, retryable email events.
 *
 * Email failures must never roll back a booking transaction. We persist an
 * email_events row (inside the booking transaction via the tx handle) and
 * dispatch asynchronously AFTER commit; failed events are retried by the
 * protected scheduled jobs endpoint.
 *
 * Concurrency: processEmailEvent() atomically CLAIMS an event by flipping
 * pending -> processing with a lease timestamp, guarded on the previous
 * status. Two concurrent dispatchers can never both claim the same event, so
 * each email is sent at most once per claim window (idempotent per lease).
 */

const MAX_ATTEMPTS = 5;
/** A 'processing' claim older than this is considered abandoned and retryable. */
const LEASE_MS = 2 * 60 * 1000;

export interface QueueEmailInput {
  eventType: EmailEventType;
  recipient: string;
  bookingId?: string;
  scheduledFor?: Date;
  payload: Record<string, unknown>;
}

/**
 * Persist an email event.
 *
 * Pass the transaction handle when called inside a booking transaction so the
 * event commits and rolls back atomically with the booking. Queue-time payload
 * validation: an invalid financial payload throws inside the transaction
 * instead of ever being rendered as ₦0.00.
 */
export async function queueEmailEvent(
  input: QueueEmailInput,
  tx?: TxLike,
): Promise<void> {
  // Reject invalid payloads at queue time — especially missing pricing on
  // priced event types. This throws so the surrounding transaction rolls back
  // and the bug surfaces in logs instead of sending a ₦0.00 email.
  const validation = validateEmailPayload(input.eventType, input.payload);
  if (!validation.ok) {
    throw new Error(`Refusing to queue email: ${validation.error}`);
  }

  const client = tx ?? db;
  const id = uuidv4();

  await client.insert(emailEvents).values({
    id,
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
 * Try to send a single email event exactly once.
 * Returns true when sent (or permanently skipped); false when it should be retried.
 */
export async function processEmailEvent(eventId: string): Promise<boolean> {
  const event = await db.query.emailEvents.findFirst({
    where: eq(emailEvents.id, eventId),
  });

  if (!event) return true;
  if (event.status === 'sent') return true;
  if (event.status === 'processing' && event.updatedAt && Date.now() - new Date(event.updatedAt).getTime() < LEASE_MS) {
    // Claimed by another worker and the lease is still fresh.
    return false;
  }
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

  // Render-time validation: never render a malformed payload (e.g. zeroed
  // financials). Fail the event so it lands in the failed-event admin view.
  const validation = validateEmailPayload(event.eventType as EmailEventType, payload);
  if (!validation.ok) {
    console.error(`Email event ${eventId}: ${validation.error}`);
    await db
      .update(emailEvents)
      .set({ status: 'failed', lastError: validation.error.slice(0, 1000) })
      .where(eq(emailEvents.id, eventId));
    return true;
  }

  // Atomic claim: pending|stale-processing -> processing. Guarded on the
  // previous state, so only ONE concurrent dispatcher wins the send.
  // Note: the lease cutoff is passed as an ISO string with an explicit cast —
  // raw Date objects in raw sql`` fragments are not serialized by the driver.
  const leaseCutoff = new Date(Date.now() - LEASE_MS).toISOString();
  const claimed = await db
    .update(emailEvents)
    .set({
      status: 'processing',
      attempts: event.attempts + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(emailEvents.id, eventId),
        // Claimable states: pending, or processing with an expired lease.
        sql`(${emailEvents.status} = 'pending' OR (${emailEvents.status} = 'processing' AND ${emailEvents.updatedAt} < ${leaseCutoff}::timestamptz))`,
        sql`${emailEvents.attempts} <= ${MAX_ATTEMPTS}`,
      ),
    )
    .returning({ id: emailEvents.id });

  if (claimed.length === 0) {
    // Another worker claimed it first.
    return false;
  }

  const html = renderEmailHtml(event.eventType as EmailEventType, payload);

  try {
    const result = await sendEmail({
      to: event.recipient,
      subject: emailSubject(event.eventType as EmailEventType, payload),
      html,
    });

    if (result.success) {
      // Guarded finalize: only the worker that is still holding the claim
      // marks it sent (protects against lease expiry racing a slow send).
      await db
        .update(emailEvents)
        .set({ status: 'sent', sentAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(and(eq(emailEvents.id, eventId), eq(emailEvents.status, 'processing')));
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
        updatedAt: new Date(),
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

/**
 * Fetch events for a booking, dispatched only after the booking transaction
 * has committed. Returns ids for the caller to dispatch.
 */
export async function getDispatchableEventIds(bookingId: string): Promise<string[]> {
  const rows: { id: string }[] = await db
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(eq(emailEvents.bookingId, bookingId))
    .orderBy(desc(emailEvents.createdAt));
  return rows.map((r) => r.id);
}

/** Retry all due pending events (safety net). Returns processed count. */
export async function retryPendingEmails(limit = 20): Promise<number> {
  const due = await db
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.status, 'pending'),
        lte(emailEvents.scheduledFor, new Date()),
        sql`${emailEvents.attempts} < ${MAX_ATTEMPTS}`,
      ),
    )
    .limit(limit);

  for (const event of due) {
    await processEmailEvent(event.id);
  }

  return due.length;
}

/**
 * Admin observability: recent failed events with their last error, newest
 * first. Used by the admin failed-emails view.
 */
export async function listFailedEmailEvents(limit = 50) {
  return db.query.emailEvents.findMany({
    where: eq(emailEvents.status, 'failed'),
    orderBy: [desc(emailEvents.updatedAt)],
    limit,
  });
}

function emailSubject(eventType: EmailEventType, payload: Record<string, unknown>): string {
  const reference = String(payload.reference ?? '');
  switch (eventType) {
    case 'booking.requested':
      return `Booking request received — ${reference}`;
    case 'booking.confirmed':
      return `Booking confirmed — ${reference}`;
    case 'booking.admin_new':
      return `New booking received — ${reference}`;
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
  // originate from our own database records, not raw user HTML. Payloads have
  // already been schema-validated before render.
  const str = (key: string): string => String(payload[key] ?? '');
  const arr = (key: string): string[] =>
    Array.isArray(payload[key]) ? (payload[key] as string[]).map(String) : [];
  const num = (key: string): number => Number(payload[key] ?? 0);

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
        total: num('total'),
        depositRequired: num('depositRequired'),
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
        total: num('total'),
        depositRequired: num('depositRequired'),
      });
    case 'booking.admin_new':
      return generateAdminBookingEmail({
        customerName: str('customerName'),
        customerEmail: str('customerEmail'),
        reference: str('reference'),
        date: str('date'),
        startTime: str('startTime'),
        endTime: str('endTime'),
        services: arr('services'),
        addons: arr('addons'),
        total: num('total'),
        depositRequired: num('depositRequired'),
        phone: str('phone'),
        notes: payload.notes ? str('notes') : undefined,
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
        addons: arr('addons'),
        previousDate: payload.previousDate ? str('previousDate') : undefined,
        previousStartTime: payload.previousStartTime ? str('previousStartTime') : undefined,
        previousEndTime: payload.previousEndTime ? str('previousEndTime') : undefined,
        wasApproved: typeof payload.wasApproved === 'boolean' ? payload.wasApproved : undefined,
        reason: payload.reason ? str('reason') : undefined,
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
