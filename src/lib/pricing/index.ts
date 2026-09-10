import { db } from '@/lib/db';
import { services, addons, bookingServices, bookingAddons, serviceImages } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { PriceSnapshot } from '@/types';

export const DEPOSIT_PERCENTAGE = 0.5; // 50% deposit required
export const DEFAULT_DEPOSIT = 500000; // 5000 NGN in kobo (minimum deposit)

/**
 * Calculate booking total from services and addons.
 * Fetches services and addons concurrently so the round-trip is a single
 * pipeline rather than two sequential queries.
 */
export async function calculateBookingTotal(
  serviceIds: string[],
  addonIds: string[]
): Promise<PriceSnapshot> {
  // Fetch services and addons concurrently.
  const [serviceRecords, addonRecords] = await Promise.all([
    serviceIds.length > 0
      ? db.select().from(services).where(inArray(services.id, serviceIds))
      : Promise.resolve([]),
    addonIds.length > 0
      ? db.select().from(addons).where(inArray(addons.id, addonIds))
      : Promise.resolve([]),
  ]);

  // Calculate totals
  const serviceTotal = serviceRecords.reduce((sum, s) => sum + s.price, 0);
  const addonTotal = addonRecords.reduce((sum, a) => sum + a.price, 0);
  const subtotal = serviceTotal + addonTotal;

  // Calculate deposit required (50% of total or minimum)
  const depositRequired = Math.max(
    Math.round(subtotal * DEPOSIT_PERCENTAGE),
    DEFAULT_DEPOSIT
  );

  const total = subtotal;

  return {
    services: serviceRecords.map(s => ({
      id: s.id,
      name: s.name,
      price: s.price,
    })),
    addons: addonRecords.map(a => ({
      id: a.id,
      name: a.name,
      price: a.price,
      quantity: 1,
    })),
    subtotal,
    depositRequired,
    total,
  };
}

/**
 * Generate a booking reference number
 */
export function generateBookingReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BP-${timestamp}-${random}`;
}

/**
 * Create booking service snapshots
 */
export async function createServiceSnapshots(
  bookingId: string,
  serviceIds: string[]
): Promise<void> {
  const serviceRecords = serviceIds.length > 0
    ? await db.select().from(services).where(inArray(services.id, serviceIds))
    : [];

  for (const service of serviceRecords) {
    await db.insert(bookingServices).values({
      id: uuidv4(),
      bookingId,
      serviceId: service.id,
      serviceNameSnapshot: service.name,
      unitPriceSnapshot: service.price,
    });
  }
}

/**
 * Create booking addon snapshots
 */
export async function createAddonSnapshots(
  bookingId: string,
  addonIds: string[]
): Promise<void> {
  const addonRecords = addonIds.length > 0
    ? await db.select().from(addons).where(inArray(addons.id, addonIds))
    : [];

  for (const addon of addonRecords) {
    await db.insert(bookingAddons).values({
      id: uuidv4(),
      bookingId,
      addonId: addon.id,
      addonNameSnapshot: addon.name,
      unitPriceSnapshot: addon.price,
      quantity: 1,
    });
  }
}

/**
 * Get service by ID
 */
export async function getServiceById(id: string) {
  const service = await db.query.services.findFirst({
    where: eq(services.id, id),
  });
  return service;
}

/**
 * Get addon by ID
 */
export async function getAddonById(id: string) {
  const addon = await db.query.addons.findFirst({
    where: eq(addons.id, id),
  });
  return addon;
}

/**
 * Get all active services
 */
export async function getActiveServices() {
  return db.query.services.findMany({
    where: eq(services.isActive, true),
    orderBy: (s) => [s.displayOrder, s.name],
  });
}

/**
 * Get service by slug (public lookup)
 */
export async function getServiceBySlug(slug: string) {
  const service = await db.query.services.findFirst({
    where: eq(services.slug, slug),
  });
  return service;
}

/**
 * Get a service by slug, joined with its images (ordered).
 * Used by the service detail page and by the booking flow pre-select.
 */
export async function getServiceBySlugWithImages(slug: string) {
  const service = await db.query.services.findFirst({
    where: eq(services.slug, slug),
  });

  if (!service) return null;

  const images = await db.query.serviceImages.findMany({
    where: eq(serviceImages.serviceId, service.id),
    orderBy: (img) => [img.displayOrder],
  });

  return {
    ...service,
    images,
  };
}

/**
 * Get service with images
 */
export async function getServiceWithImages(id: string) {
  const service = await db.query.services.findFirst({
    where: eq(services.id, id),
  });

  if (!service) return null;

  const images = await db.query.serviceImages.findMany({
    where: eq(serviceImages.serviceId, id),
    orderBy: (img) => [img.displayOrder],
  });

  return {
    ...service,
    images,
  };
}

/**
 * Get all active addons
 */
export async function getActiveAddons() {
  return db.query.addons.findMany({
    where: eq(addons.isActive, true),
    orderBy: (a) => [a.displayOrder, a.name],
  });
}
