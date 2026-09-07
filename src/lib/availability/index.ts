import { db } from '@/lib/db';
import { availabilityOverrides, bookings } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
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

/**
 * Get all available slots for a given date
 */
export async function getAvailableSlots(date: string): Promise<AvailableSlot[]> {
  const dateObj = new Date(date + 'T00:00:00');

  // Check if it's a business day
  if (!isBusinessDay(dateObj)) {
    return [];
  }

  // Get standard slots for the day
  const standardSlots = getStandardSlots(dateObj);

  // Get blocked slots from availability overrides
  const blockedSlots = await getBlockedSlots(date);

  // Get booked slots (pending and confirmed)
  const bookedSlots = await getBookedSlots(date);

  // Filter slots
  const availableSlots: AvailableSlot[] = [];

  for (const slot of standardSlots) {
    const key = slotToKey(slot);
    const isBlocked = blockedSlots.has(key);
    const isBooked = bookedSlots.has(key);

    if (!isBlocked && !isBooked) {
      availableSlots.push({
        ...slot,
        available: true,
      });
    } else {
      availableSlots.push({
        ...slot,
        available: false,
        reason: isBlocked ? 'blocked' : 'booked',
      });
    }
  }

  return availableSlots;
}

/**
 * Check if a specific slot is available
 */
export async function isSlotAvailable(
  date: string,
  startTime: string,
  endTime: string
): Promise<{ available: boolean; reason?: string }> {
  // Check if it's a business day
  const dateObj = new Date(date + 'T00:00:00');
  if (!isBusinessDay(dateObj)) {
    return { available: false, reason: 'closed' };
  }

  // Check booking window
  const slotDateTime = parseSlotToDateTime({ date, startTime, endTime });
  if (!isWithinBookingWindow(slotDateTime.start)) {
    return { available: false, reason: 'outside_booking_window' };
  }

  // Check same-day rule
  if (!validateSameDayBooking(slotDateTime.start)) {
    return { available: false, reason: 'too_soon' };
  }

  // Check if slot is blocked
  const blockedSlots = await getBlockedSlots(date);
  const slotKey = slotToKey({ date, startTime, endTime });

  if (blockedSlots.has(slotKey)) {
    return { available: false, reason: 'blocked' };
  }

  // Check if slot is already booked
  const bookedSlots = await getBookedSlots(date);
  if (bookedSlots.has(slotKey)) {
    return { available: false, reason: 'booked' };
  }

  return { available: true };
}

/**
 * Get blocked slots from availability overrides
 */
async function getBlockedSlots(date: string): Promise<Set<string>> {
  const blocked = new Set<string>();

  // Get all overrides for the date
  const overrides = await db.query.availabilityOverrides.findMany({
    where: eq(availabilityOverrides.date, date),
  });

  for (const override of overrides) {
    if (override.mode === 'blocked') {
      blocked.add(slotToKey({
        date: override.date,
        startTime: override.startTime,
        endTime: override.endTime,
      }));
    }
  }

  return blocked;
}

/**
 * Get booked slots (pending and confirmed)
 */
async function getBookedSlots(date: string): Promise<Set<string>> {
  const booked = new Set<string>();

  // Get all active bookings for the date
  const activeBookings = await db.query.bookings.findMany({
    where: and(
      eq(bookings.appointmentDate, date),
      or(
        eq(bookings.status, 'pending'),
        eq(bookings.status, 'confirmed')
      )
    ),
  });

  for (const booking of activeBookings) {
    booked.add(slotToKey({
      date: booking.appointmentDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
    }));
  }

  return booked;
}

/**
 * Validate booking parameters
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
