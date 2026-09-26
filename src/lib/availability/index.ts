import { db } from '@/lib/db';
import { availabilityOverrides, bookings } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { SLOT_OCCUPYING_STATUSES } from '@/lib/booking/lifecycle';
import {
  isBusinessDay,
  getStandardSlots,
  parseSlotToDateTime,
  validateSameDayBooking,
  isWithinBookingWindow,
  slotToKey,
  type Slot,
} from '@/lib/timezone';

export interface AvailableSlot extends Slot {
  available: boolean;
  reason?: string;
}

/** Statuses that occupy a slot. Pending intentionally blocks until admin decision.
 * Kept in sync with SLOT_OCCUPYING_STATUSES in src/lib/booking/lifecycle.ts
 * (and the partial unique index): pending/confirmed/approved block the slot;
 * ignored, cancelled, rejected, completed, and no-show bookings release it. */
const OCCUPYING_STATUSES = SLOT_OCCUPYING_STATUSES;

function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/**
 * In-memory cache for availability data within a single request lifecycle.
 * Both getAvailableSlots and isSlotAvailable share the same underlying
 * DB queries (overrides + booked slots) when they work on the same date.
 * The cache is cleared at the end of each API call via clearRequestCache().
 */
const requestCache = new Map<string, {
  overrides: OverrideRow[];
  bookedSlots: Set<string>;
}>();

function cacheKey(date: string) {
  return `avail:${date}`;
}

interface OverrideRow {
  startTime: string;
  endTime: string;
  mode: string;
}

type DbLike = typeof db;

/**
 * Fetch overrides and booked slots for a date, using the in-request cache
 * so that concurrent calls within the same API request only hit the DB once.
 * The two queries run in parallel since they're independent.
 */
async function getAvailabilityData(
  date: string,
  _db?: DbLike,
): Promise<{ overrides: OverrideRow[]; bookedSlots: Set<string> }> {
  const ck = cacheKey(date);
  const cached = requestCache.get(ck);
  if (cached) return cached;

  const client = _db ?? db;

  // Run both queries concurrently — they're independent of each other.
  const [overrides, activeBookings] = await Promise.all([
    client
      .select({
        startTime: availabilityOverrides.startTime,
        endTime: availabilityOverrides.endTime,
        mode: availabilityOverrides.mode,
      })
      .from(availabilityOverrides)
      .where(eq(availabilityOverrides.date, date)),
    client.query.bookings.findMany({
      where: and(
        eq(bookings.appointmentDate, date),
        inArray(bookings.status, [...OCCUPYING_STATUSES]),
      ),
    }),
  ]);

  const bookedSlots = new Set<string>();
  for (const booking of activeBookings) {
    bookedSlots.add(
      slotToKey({
        date: booking.appointmentDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
      }),
    );
  }

  const data = { overrides, bookedSlots };
  requestCache.set(ck, data);
  return data;
}

function clearRequestCache() {
  requestCache.clear();
}

function getBlockedSlotKeys(date: string, overrides: OverrideRow[]): Set<string> {
  const blocked = new Set<string>();
  for (const override of overrides) {
    if (override.mode === 'blocked') {
      blocked.add(
        slotToKey({ date, startTime: override.startTime, endTime: override.endTime }),
      );
    }
  }
  return blocked;
}

/**
 * Get all slots for a given date with availability information.
 * Includes slots opened by admin overrides even on normally closed days.
 * Applies the booking window and same-day rules (informational; the server
 * re-validates authoritatively at booking time).
 */
export async function getAvailableSlots(date: string, _db?: typeof db): Promise<AvailableSlot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return [];
  }

  // Get standard slots for the day (empty on closed days)
  const standardSlots = getStandardSlots(date);

  // Get admin overrides + booked slots in parallel, cached for this request.
  const { overrides, bookedSlots } = await getAvailabilityData(date, _db);

  const standardKeys = new Set(standardSlots.map(slotToKey));

  // Slots explicitly opened by admin (may exist on closed days)
  const openedSlots: Slot[] = overrides
    .filter((o) => o.mode === 'available')
    .map((o) => ({ date, startTime: o.startTime, endTime: o.endTime }))
    .filter((s) => !standardKeys.has(slotToKey(s)));

  const allSlots = [...standardSlots, ...openedSlots];

  if (allSlots.length === 0) {
    return [];
  }

  // Same-day/booking-window checks per slot (true instants)
  const nowCheck = new Map<string, { ok: boolean; reason?: string }>();
  for (const slot of allSlots) {
    try {
      const { start } = parseSlotToDateTime(slot);
      if (!isWithinBookingWindow(start)) {
        nowCheck.set(slotToKey(slot), { ok: false, reason: 'outside_booking_window' });
      } else if (!validateSameDayBooking(start)) {
        nowCheck.set(slotToKey(slot), { ok: false, reason: 'too_soon' });
      } else {
        nowCheck.set(slotToKey(slot), { ok: true });
      }
    } catch {
      nowCheck.set(slotToKey(slot), { ok: false, reason: 'invalid_slot' });
    }
  }

  const blockedSlots = getBlockedSlotKeys(date, overrides);

  return allSlots.map((slot) => {
    const key = slotToKey(slot);

    if (bookedSlots.has(key)) {
      return { ...slot, available: false, reason: 'booked' };
    }
    if (blockedSlots.has(key)) {
      return { ...slot, available: false, reason: 'blocked' };
    }
    const timeCheck = nowCheck.get(key);
    if (timeCheck && !timeCheck.ok) {
      return { ...slot, available: false, reason: timeCheck.reason };
    }
    return { ...slot, available: true };
  });
}

/**
 * Check if a specific slot is available.
 * The slot must be either a standard template slot or explicitly opened by an
 * admin override — arbitrary times are never bookable.
 */
export async function isSlotAvailable(
  date: string,
  startTime: string,
  endTime: string,
  _db?: DbLike,
): Promise<{ available: boolean; reason?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValidTime(startTime) || !isValidTime(endTime)) {
    return { available: false, reason: 'invalid_slot' };
  }

  const slot: Slot = { date, startTime, endTime };
  let slotTimes;
  try {
    slotTimes = parseSlotToDateTime(slot);
  } catch {
    return { available: false, reason: 'invalid_slot' };
  }

  // The slot must exist as a standard slot OR be explicitly opened by an override.
  const standardSlots = getStandardSlots(date);
  const standardKeys = new Set(standardSlots.map(slotToKey));
  const { overrides, bookedSlots } = await getAvailabilityData(date, _db);
  const openedKeys = new Set(
    overrides
      .filter((o) => o.mode === 'available')
      .map((o) => slotToKey({ date, startTime: o.startTime, endTime: o.endTime })),
  );

  const slotKey = slotToKey(slot);
  const isDefinedSlot = standardKeys.has(slotKey) || openedKeys.has(slotKey);
  if (!isDefinedSlot) {
    return { available: false, reason: 'slot_not_offered' };
  }

  // Booking window
  if (!isWithinBookingWindow(slotTimes.start)) {
    return { available: false, reason: 'outside_booking_window' };
  }

  // Same-day rule (start at least 1 hour from now)
  if (!validateSameDayBooking(slotTimes.start)) {
    return { available: false, reason: 'too_soon' };
  }

  // Closed days are only bookable when an override explicitly opens the slot
  if (!isBusinessDay(date) && !openedKeys.has(slotKey)) {
    return { available: false, reason: 'closed' };
  }

  // Check if slot is blocked
  const blockedSlots = getBlockedSlotKeys(date, overrides);
  if (blockedSlots.has(slotKey)) {
    return { available: false, reason: 'blocked' };
  }

  // Check if slot is already booked (from cached result)
  if (bookedSlots.has(slotKey)) {
    return { available: false, reason: 'booked' };
  }

  return { available: true };
}

/**
 * Validate booking parameters (authoritative server-side check).
 */
export async function validateBookingSlot(
  date: string,
  startTime: string,
  endTime: string,
): Promise<{ valid: boolean; error?: string }> {
  const result = await isSlotAvailable(date, startTime, endTime);

  if (!result.available) {
    return { valid: false, error: result.reason };
  }

  return { valid: true };
}

/**
 * Expose the cache clearer so API routes can flush between requests.
 * In serverless/Edge contexts each invocation gets its own module instance,
 * but in long-lived Node dev servers or when multiple calls share a process,
 * this prevents stale data across unrelated requests.
 */
export { clearRequestCache };
