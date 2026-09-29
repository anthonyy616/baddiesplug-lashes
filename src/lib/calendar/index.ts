import { db } from '@/lib/db';
import { availabilityOverrides, bookings, users } from '@/lib/db/schema';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { SLOT_OCCUPYING_STATUSES } from '@/lib/booking/lifecycle';
import { getStandardSlots, isBusinessDay } from '@/lib/timezone';
import type { Booking } from '@/types';

/**
 * Admin Calendar V2 (Stage 8) — READ MODEL ONLY.
 *
 * The calendar never mutates bookings and never introduces a second mutation
 * path: every action (open details, create, reschedule) links into the
 * EXISTING surfaces — booking detail page, admin create flow, and the
 * Rescheduling V2 command. Reschedule initiation from the calendar pre-fills
 * the booking detail reschedule form; it never persists anything itself.
 */

export interface CalendarBooking {
  id: string;
  reference: string;
  status: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  /** First service snapshot name (summary display). */
  serviceName: string;
  total: number;
}

export interface CalendarDay {
  date: string;
  /** Standard slots with availability state (authoritative server logic). */
  slots: { startTime: string; endTime: string; available: boolean }[];
  /** Blocked periods (admin overrides in 'blocked' mode). */
  blocked: { startTime: string; endTime: string }[];
  /** Opened extra slots (admin overrides in 'available' mode). */
  opened: { startTime: string; endTime: string }[];
  bookings: CalendarBooking[];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** Inclusive list of Lagos date strings for a range. */
export function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 400) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return days;
}

/**
 * Calendar data for an inclusive date range. Availability shown per day is
 * the SAME authoritative projection the customer booking flow sees
 * (standard slots + admin overrides minus slot-occupying bookings).
 */
export async function getCalendarRange(
  from: string,
  to: string
): Promise<{ days: CalendarDay[] }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw new Error('Invalid calendar range');
  }

  const dates = enumerateDays(from, to);

  const [bookingRows, overrideRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        reference: bookings.reference,
        status: bookings.status,
        appointmentDate: bookings.appointmentDate,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        total: bookings.total,
        customerName: users.name,
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.customerId))
      .where(and(gte(bookings.appointmentDate, from), lte(bookings.appointmentDate, to)))
      .orderBy(asc(bookings.appointmentDate), asc(bookings.startTime)),
    db
      .select({
        date: availabilityOverrides.date,
        startTime: availabilityOverrides.startTime,
        endTime: availabilityOverrides.endTime,
        mode: availabilityOverrides.mode,
      })
      .from(availabilityOverrides)
      .where(and(gte(availabilityOverrides.date, from), lte(availabilityOverrides.date, to))),
  ]);

  // Service names for the bookings shown (snapshot names).
  const { bookingServices } = await import('@/lib/db/schema');
  const bookingIds = bookingRows.map((b) => b.id);
  const serviceRows = bookingIds.length
    ? await db
        .select({ bookingId: bookingServices.bookingId, name: bookingServices.serviceNameSnapshot })
        .from(bookingServices)
    : [];
  const serviceByBooking = new Map<string, string>();
  for (const row of serviceRows) {
    if (!serviceByBooking.has(row.bookingId)) serviceByBooking.set(row.bookingId, row.name);
  }

  const bookingsByDate = new Map<string, CalendarBooking[]>();
  for (const row of bookingRows) {
    const list = bookingsByDate.get(row.appointmentDate) ?? [];
    list.push({
      id: row.id,
      reference: row.reference,
      status: row.status,
      appointmentDate: row.appointmentDate,
      startTime: row.startTime,
      endTime: row.endTime,
      customerName: row.customerName,
      serviceName: serviceByBooking.get(row.id) ?? 'Service',
      total: row.total,
    });
    bookingsByDate.set(row.appointmentDate, list);
  }

  const overridesByDate = new Map<string, { startTime: string; endTime: string; mode: string }[]>();
  for (const row of overrideRows) {
    const list = overridesByDate.get(row.date) ?? [];
    list.push(row);
    overridesByDate.set(row.date, list);
  }

  // Slot-occupying keys per date for availability computation.
  const occupiedByDate = new Map<string, Set<string>>();
  for (const row of bookingRows) {
    if (!(SLOT_OCCUPYING_STATUSES as readonly string[]).includes(row.status)) continue;
    const set = occupiedByDate.get(row.appointmentDate) ?? new Set<string>();
    set.add(`${row.startTime}-${row.endTime}`);
    occupiedByDate.set(row.appointmentDate, set);
  }

  const days: CalendarDay[] = dates.map((date) => {
    const overrides = overridesByDate.get(date) ?? [];
    const blocked = overrides
      .filter((o) => o.mode === 'blocked')
      .map((o) => ({ startTime: o.startTime, endTime: o.endTime }));
    const opened = overrides
      .filter((o) => o.mode === 'available')
      .map((o) => ({ startTime: o.startTime, endTime: o.endTime }));

    const occupied = occupiedByDate.get(date) ?? new Set<string>();
    const blockedKeys = new Set(blocked.map((b) => `${b.startTime}-${b.endTime}`));

    // Standard slots (empty on non-business days) + opened extra slots.
    const standardSlots = getStandardSlots(date).map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      available:
        !occupied.has(`${s.startTime}-${s.endTime}`) && !blockedKeys.has(`${s.startTime}-${s.endTime}`),
    }));
    const openedSlots = opened
      .filter((o) => !standardSlots.some((s) => s.startTime === o.startTime))
      .map((o) => ({
        startTime: o.startTime,
        endTime: o.endTime,
        available: !occupied.has(`${o.startTime}-${o.endTime}`),
      }));

    return {
      date,
      slots: [...standardSlots, ...openedSlots],
      blocked,
      opened,
      bookings: bookingsByDate.get(date) ?? [],
    };
  });

  return { days };
}
