import { db } from '@/lib/db';
import { bookingEvent, bookings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { BookingEventType } from '@/types';
import { CUSTOMER_BOOKING_EVENT_TYPES } from '@/types';

/**
 * Booking activity timeline (Stage 5).
 *
 * Derived ENTIRELY from the durable booking_event audit table — the timeline
 * never mutates anything and never invents entries. Every projection below is
 * a pure function over the append-only event rows.
 *
 * Two views over the same events:
 * - Admin: full operational detail (actor ids, internal metadata, related
 *   bookings).
 * - Customer: only customer-appropriate event types, with only customer-safe
 *   fields. Internal-only notes, admin identity details, and implementation
 *   metadata are never exposed.
 */

export interface TimelineEntry {
  id: string;
  eventType: BookingEventType;
  /** Human-readable label, e.g. "Booking created". */
  label: string;
  /** Human-readable detail sentence(s), customer-safe wording. */
  description: string;
  /** ISO timestamp of the event. */
  occurredAt: string;
  actorType: 'customer' | 'admin' | 'system';
  /** Admin-only fields (absent in customer projections). */
  actorId?: string | null;
  relatedBookingId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Event types a customer may see. Mirrors CUSTOMER_BOOKING_EVENT_TYPES. */
export const CUSTOMER_EVENT_TYPES: readonly string[] = CUSTOMER_BOOKING_EVENT_TYPES;

const LABELS: Record<BookingEventType, string> = {
  created: 'Booking created',
  rescheduled: 'Booking rescheduled',
  cancelled: 'Booking cancelled',
  approved: 'Booking approved',
  rejected: 'Booking rejected',
  completed: 'Appointment completed',
  no_show: 'Marked as no-show',
  payment_recorded: 'Payment recorded',
  reminder_sent: 'Reminder sent',
  status_changed: 'Status updated',
};

function describe(
  eventType: BookingEventType,
  metadata: Record<string, unknown> | null,
  viewer: 'admin' | 'customer'
): string {
  const meta = metadata ?? {};
  const reference = typeof meta.reference === 'string' ? meta.reference : null;
  const reason = typeof meta.reason === 'string' ? meta.reason : null;
  const newDate = typeof meta.newDate === 'string' ? meta.newDate : null;
  const newStartTime = typeof meta.newStartTime === 'string' ? meta.newStartTime : null;
  const newReference = typeof meta.newReference === 'string' ? meta.newReference : null;
  const amount = typeof meta.amount === 'number' ? meta.amount : null;
  const paymentType = typeof meta.paymentType === 'string' ? meta.paymentType : null;

  switch (eventType) {
    case 'created':
      return reference
        ? `Booking ${reference} was created.`
        : 'The booking was created.';
    case 'rescheduled': {
      const to = newDate
        ? ` to ${newDate}${newStartTime ? ` at ${newStartTime}` : ''}`
        : '';
      const link = viewer === 'admin' && newReference ? ` (new reference ${newReference})` : '';
      const why = reason ? ` Reason: ${reason}` : '';
      return `The appointment was rescheduled${to}${link}.${why}`.trim();
    }
    case 'cancelled':
      return reason
        ? `The booking was cancelled. Reason: ${reason}`
        : 'The booking was cancelled.';
    case 'approved':
      return 'The booking was approved.';
    case 'rejected':
      return 'The booking was rejected.';
    case 'completed':
      return 'The appointment was completed.';
    case 'no_show':
      return 'The client did not attend the appointment.';
    case 'payment_recorded': {
      const shown = amount !== null ? `₦${(amount / 100).toFixed(2)}` : 'A payment';
      const type = paymentType ? ` (${paymentType})` : '';
      return `${shown}${type} was recorded for this booking.`;
    }
    case 'reminder_sent':
      return 'An appointment reminder was sent.';
    case 'status_changed':
      return 'The booking status was updated.';
    default:
      return 'The booking was updated.';
  }
}

interface RawEvent {
  id: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  relatedBookingId: string | null;
  metadata: string | null;
  createdAt: Date;
}

function toTimelineEntry(
  event: RawEvent,
  viewer: 'admin' | 'customer'
): TimelineEntry {
  let metadata: Record<string, unknown> | null = null;
  if (event.metadata) {
    try {
      const parsed: unknown = JSON.parse(event.metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>;
      }
    } catch {
      metadata = null;
    }
  }

  const eventType = event.eventType as BookingEventType;
  const entry: TimelineEntry = {
    id: event.id,
    eventType,
    label: LABELS[eventType] ?? 'Booking updated',
    description: describe(eventType, metadata, viewer),
    occurredAt: event.createdAt.toISOString(),
    actorType: (event.actorType as TimelineEntry['actorType']) ?? 'system',
  };

  if (viewer === 'admin') {
    entry.actorId = event.actorId;
    entry.relatedBookingId = event.relatedBookingId;
    if (metadata) entry.metadata = metadata;
  }

  return entry;
}

/** Full operational timeline for admins. */
export async function getAdminBookingTimeline(bookingId: string): Promise<TimelineEntry[]> {
  const rows = await db
    .select()
    .from(bookingEvent)
    .where(eq(bookingEvent.bookingId, bookingId))
    .orderBy(bookingEvent.createdAt);

  return rows.map((row) => toTimelineEntry(row, 'admin'));
}

/**
 * Customer-safe timeline: only customer-appropriate event types, and only
 * customer-safe fields. Internal notes, admin actor ids, and raw metadata are
 * never included.
 */
export async function getCustomerBookingTimeline(
  bookingId: string,
  customerId: string
): Promise<TimelineEntry[]> {
  // Ownership is verified by the caller; the bookingId+customerId pair here
  // additionally scopes the event read so a leaked id cannot read another
  // customer's timeline.
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    columns: { id: true, customerId: true },
  });
  if (!booking || booking.customerId !== customerId) {
    return [];
  }

  const rows = await db
    .select()
    .from(bookingEvent)
    .where(eq(bookingEvent.bookingId, bookingId))
    .orderBy(bookingEvent.createdAt);

  return rows
    .filter((row) => CUSTOMER_EVENT_TYPES.includes(row.eventType))
    .map((row) => toTimelineEntry(row, 'customer'));
}
