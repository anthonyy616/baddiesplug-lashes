import { db } from '@/lib/db';
import { favouriteServices, services, bookingServices, bookingAddons, bookings, addons } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/types';

/**
 * Favourite services (Stage 3).
 *
 * Favourites ALWAYS belong to the authenticated customer: every query is
 * scoped by customer_id taken from the session, never from request input,
 * so one customer can never read or mutate another customer's favourites.
 */

/** List the authenticated customer's favourite services (active only). */
export async function getFavouriteServices() {
  const user = await requireAuth();

  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      slug: services.slug,
      category: services.category,
      subcategory: services.subcategory,
      description: services.description,
      price: services.price,
      durationMinutes: services.durationMinutes,
      isActive: services.isActive,
      favouritedAt: favouriteServices.createdAt,
    })
    .from(favouriteServices)
    .innerJoin(services, eq(services.id, favouriteServices.serviceId))
    .where(eq(favouriteServices.customerId, user.id))
    .orderBy(desc(favouriteServices.createdAt));

  // Deactivated services stay listed (marked) so customers understand their
  // history, but they cannot be booked while inactive.
  return rows;
}

/** Add a service to the authenticated customer's favourites. Idempotent. */
export async function addFavouriteService(serviceId: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();

  const service = await db.query.services.findFirst({
    where: eq(services.id, serviceId),
  });
  if (!service) {
    return { success: false, error: 'Service not found' };
  }

  // Idempotent: a duplicate favourite is a no-op, not an error.
  await db
    .insert(favouriteServices)
    .values({ customerId: user.id, serviceId })
    .onConflictDoNothing();

  return { success: true };
}

/** Remove a service from the authenticated customer's favourites. */
export async function removeFavouriteService(serviceId: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();

  // Scoped by BOTH customer and service: a customer can only ever remove
  // their own favourite rows.
  await db
    .delete(favouriteServices)
    .where(
      and(
        eq(favouriteServices.customerId, user.id),
        eq(favouriteServices.serviceId, serviceId),
      ),
    );

  return { success: true };
}

/**
 * BOOK AGAIN (Stage 3): resolve a past booking into pre-fill data for the
 * NEW booking flow.
 *
 * This is a convenience lookup, NOT booking duplication. It returns service
 * and add-on ids where those items STILL exist and are active — never prices
 * (the server recalculates from the current catalogue) and never a slot (the
 * customer must choose a new date/time and pass normal availability checks).
 */
export async function getBookAgainData(
  bookingId: string,
  customerId: string
): Promise<{
  success: boolean;
  error?: string;
  serviceIds?: string[];
  addonIds?: string[];
  unavailableServiceNames?: string[];
  unavailableAddonNames?: string[];
}> {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  // Ownership: only the booking's own customer may use Book Again on it.
  if (booking.customerId !== customerId) {
    return { success: false, error: 'Unauthorized' };
  }

  const [pastServices, pastAddons] = await Promise.all([
    db.query.bookingServices.findMany({
      where: eq(bookingServices.bookingId, bookingId),
    }),
    db.query.bookingAddons.findMany({
      where: eq(bookingAddons.bookingId, bookingId),
    }),
  ]);

  // Resolve against the CURRENT catalogue: only still-existing, active items
  // are pre-selected. Everything else is reported so the UI can explain why.
  const catalogueServices = await db.query.services.findMany({
    where: eq(services.isActive, true),
  });
  const catalogueAddons = await db.query.addons.findMany();
  const activeServiceIds = new Set(catalogueServices.map((s) => s.id));
  const activeAddonIds = new Set(
    catalogueAddons.filter((a) => a.isActive).map((a) => a.id)
  );

  const serviceIds = pastServices
    .map((s) => s.serviceId)
    .filter((id) => activeServiceIds.has(id));
  const addonIds = pastAddons
    .map((a) => a.addonId)
    .filter((id) => activeAddonIds.has(id));

  const unavailableServiceNames = pastServices
    .filter((s) => !activeServiceIds.has(s.serviceId))
    .map((s) => s.serviceNameSnapshot);
  const unavailableAddonNames = pastAddons
    .filter((a) => !activeAddonIds.has(a.addonId))
    .map((a) => a.addonNameSnapshot);

  return {
    success: true,
    serviceIds,
    addonIds,
    unavailableServiceNames,
    unavailableAddonNames,
  };
}
