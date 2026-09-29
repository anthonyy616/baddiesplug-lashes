import { db } from '@/lib/db';
import { beforeAfterGallery, bookings } from '@/lib/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import type { BeforeAfterEntry } from '@/types';

/**
 * Before/after client gallery domain (Stage 6).
 *
 * CONSENT/PUBLICATION RULES (enforced here, the single authority):
 * - An entry is NEVER public just because it was uploaded. `isPublic` starts
 *   false; publication is an explicit admin action.
 * - An entry can only be published when client consent is recorded
 *   (`clientConsent = true`). Toggling consent off unpublishes.
 * - Booking association is allowed ONLY for completed bookings, and only
 *   records the association — private booking reference images (R2 keys under
 *   `reference/`) are never gallery media.
 */

/** Draft rows for the admin manager (all entries, any visibility). */
export async function getBeforeAfterEntries(): Promise<BeforeAfterEntry[]> {
  const rows = await db
    .select()
    .from(beforeAfterGallery)
    .orderBy(asc(beforeAfterGallery.displayOrder), asc(beforeAfterGallery.createdAt));

  return rows.map(toEntry);
}

/** Public showcase rows: ONLY published entries, in display order. */
export async function getPublicBeforeAfterEntries(): Promise<BeforeAfterEntry[]> {
  const rows = await db
    .select()
    .from(beforeAfterGallery)
    .where(eq(beforeAfterGallery.isPublic, true))
    .orderBy(asc(beforeAfterGallery.displayOrder), asc(beforeAfterGallery.createdAt));

  return rows.map(toEntry);
}

/** Public rows for one service. */
export async function getPublicBeforeAfterForService(
  serviceId: string
): Promise<BeforeAfterEntry[]> {
  const rows = await db
    .select()
    .from(beforeAfterGallery)
    .where(
      and(
        eq(beforeAfterGallery.isPublic, true),
        eq(beforeAfterGallery.serviceId, serviceId)
      )
    )
    .orderBy(asc(beforeAfterGallery.displayOrder));

  return rows.map(toEntry);
}

/**
 * Whether a booking may be associated with a gallery entry: only COMPLETED
 * bookings qualify. Reused by the API layer for create + PATCH.
 */
export async function isCompletedBooking(bookingId: string): Promise<boolean> {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    columns: { id: true, status: true },
  });
  return Boolean(booking && booking.status === 'completed');
}

/** Publication guard shared by the create/PATCH API paths. */
export function canPublish(input: { isPublic: boolean; clientConsent: boolean }): boolean {
  return input.isPublic && input.clientConsent;
}

function toEntry(row: typeof beforeAfterGallery.$inferSelect): BeforeAfterEntry {
  return {
    id: row.id,
    beforePublicUrl: row.beforePublicUrl,
    afterPublicUrl: row.afterPublicUrl,
    beforeWidth: row.beforeWidth,
    beforeHeight: row.beforeHeight,
    afterWidth: row.afterWidth,
    afterHeight: row.afterHeight,
    serviceId: row.serviceId,
    bookingId: row.bookingId,
    caption: row.caption,
    altText: row.altText,
    isPublic: row.isPublic,
    clientConsent: row.clientConsent,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt.toISOString(),
  };
}
