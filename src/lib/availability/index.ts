import { db } from '@/lib/db';
import { availabilityOverrides, bookings } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
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

/** Statuses that occupy a slot. Pending intentionally blocks until admin decision. */
const OCCUPYING_STATUSES = ['pending', 'confirmed'] as const;

function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/**
 * Get all slots for a given date with availability information.
 * Includes slots opened by admin overrides even on normally closed days.
 * Applies the booking window and same-day rules (informational; the server
 * re-validates authoritatively at booking time).
 */
export async function getAvailableSlots(date: string, _db?:typeof db): Promise<AvailableSlot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return [];
  }

  // Get standard slots for the day (empty on closed days)
  const standardSlots = getStandardSlots(date);

  // Get admin overrides for the date
  const overrides = await getOverrides(date, _db);

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

  // Get blocked slots from availability overrides
  const blockedSlots = getBlockedSlotKeys(date, overrides);

  // Get occupied slots (pending and confirmed bookings)
  const bookedSlots = await getBookedSlots(date, _db);

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
  _db?: DbLike
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
  const overrides = await getOverrides(date, _db);
  const openedKeys = new Set(
    overrides
      .filter((o) => o.mode === 'available')
      .map((o) => slotToKey({ date, startTime: o.startTime, endTime: o.endTime }))
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

  // Check if slot is already booked
  const bookedSlots = await getBookedSlots(date, _db);
  if (bookedSlots.has(slotKey)) {
    return { available: false, reason: 'booked' };
  }

  return { available: true };
}

interface OverrideRow {
  startTime: string;
  endTime: string;
  mode: string;
}

type DbLike = typeof db;

function getOverrides(date: string, _db?: DbLike): Promise<OverrideRow[]> {
  const client = _db ?? db;
  return client
    .select({ startTime: availabilityOverrides.startTime, endTime: availabilityOverrides.endTime, mode: availabilityOverrides.mode })
    .from(availabilityOverrides)
    .where(eq(availabilityOverrides.date, date));
}

function getBlockedSlotKeys(date: string, overrides: OverrideRow[]): Set<string> {
  const blocked = new Set<string>();
  for (const override of overrides) {
    if (override.mode === 'blocked') {
      blocked.add(
        slotToKey({ date, startTime: override.startTime, endTime: override.endTime })
      );
    }
  }
  return blocked;
}

/**
 * Get occupied slots for a date (pending and confirmed bookings).
 */
export async function getBookedSlots(date: string, _db?: DbLike): Promise<Set<string>> {
  const client = _db ?? db;
  const booked = new Set<string>();

  const activeBookings = await client.query.bookings.findMany({
    where: and(
      eq(bookings.appointmentDate, date),
      inArray(bookings.status, [...OCCUPYING_STATUSES])
    ),
  });

  for (const booking of activeBookings) {
    booked.add(
      slotToKey({
        date: booking.appointmentDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
      })
    );
  }

  return booked;
}

/**
 * Validate booking parameters (authoritative server-side check).
 */
export async function validateBookingSlot(
  date: string,
  startTime: string,
  endTime: string
): Promise<{ valid: boolean; error?: string }> {
  const result = await isSlotAvailable(date, startTime, endTime);

  if (!result.available) {
    return { valid: false, error: result.reason };
  }

  return { valid: true };
}
