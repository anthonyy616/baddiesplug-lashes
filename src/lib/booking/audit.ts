import type { TxLike } from '@/lib/db/tx';
import { bookingEvent } from '@/lib/db/schema';
import type { BookingEventType } from '@/types';

/**
 * Append an immutable booking audit event. MUST be called with a transaction
 * handle when part of a booking mutation so the audit row commits/rolls back
 * together with the change it describes. Rows are never updated or deleted.
 */
export async function recordBookingEvent(
  input: {
    bookingId: string;
    eventType: BookingEventType;
    actorType: 'customer' | 'admin' | 'system';
    actorId?: string | null;
    relatedBookingId?: string | null;
    metadata?: Record<string, unknown>;
  },
  tx?: TxLike,
): Promise<void> {
  const client = tx ?? (await import('@/lib/db')).db;
  await client.insert(bookingEvent).values({
    bookingId: input.bookingId,
    eventType: input.eventType,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    relatedBookingId: input.relatedBookingId ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}
