import {
  format,
  addHours,
  addMonths,
  isWithinInterval,
  isBefore,
  isAfter,
  differenceInMinutes,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * All business date/time logic uses Africa/Lagos.
 *
 * Terminology used in this module:
 * - "Lagos calendar date": a YYYY-MM-DD string representing a calendar day in Lagos.
 *   Slot identity is based on Lagos calendar dates (see booking-rules.md).
 * - "UTC instant": a real JS Date representing an absolute point in time.
 *   Comparisons between instants (same-day rule, booking window) must use UTC
 *   instants on both sides, never wall-clock-shifted values.
 */

export const BUSINESS_TIMEZONE = 'Africa/Lagos';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Wall-clock representation of an instant in Lagos time (for display/formatting). */
export function getLagosTime(date: Date = new Date()): Date {
  return toZonedTime(date, BUSINESS_TIMEZONE);
}

export function toLagosTime(date: Date): Date {
  return toZonedTime(date, BUSINESS_TIMEZONE);
}

/** Interpret a Lagos wall-clock Date as the true UTC instant. */
export function fromLagosTime(date: Date): Date {
  return fromZonedTime(date, BUSINESS_TIMEZONE);
}

export function formatLagosTime(date: Date, formatStr: string): string {
  return format(toLagosTime(date), formatStr);
}

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return (
    m >= 1 && m <= 12 && d >= 1 && d <= 31 &&
    !Number.isNaN(new Date(Date.UTC(y, m - 1, d)).getTime())
  );
}

export function isValidTimeString(value: string): boolean {
  return TIME_RE.test(value);
}

function toDateString(date: Date | string): string {
  if (typeof date === 'string') return date;
  return format(toLagosTime(date), 'yyyy-MM-dd');
}

/**
 * Business days are Tuesday–Friday (Monday and weekends closed).
 * Accepts a Lagos calendar date string (preferred) or a Date (its Lagos
 * wall-clock date is used).
 */
export function isBusinessDay(date: Date | string): boolean {
  const dateStr = toDateString(date);
  if (!isValidDateString(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  // Tuesday = 2, Wednesday = 3, Thursday = 4, Friday = 5
  return dayOfWeek >= 2 && dayOfWeek <= 5;
}

export function isOpenDay(date: Date | string): boolean {
  return isBusinessDay(date);
}

export interface Slot {
  date: string; // YYYY-MM-DD (Lagos calendar date)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface DateTimeSlot extends Slot {
  start: Date; // UTC instant
  end: Date; // UTC instant
}

/**
 * Standard predefined slots: Tuesday–Friday, four 2-hour slots.
 * These are the ONLY times customers may book (plus slots explicitly opened
 * by admin overrides).
 */
export function getStandardSlots(date: Date | string): Slot[] {
  const dateStr = toDateString(date);
  if (!isValidDateString(dateStr) || !isBusinessDay(dateStr)) {
    return [];
  }

  return [
    { date: dateStr, startTime: '09:00', endTime: '11:00' },
    { date: dateStr, startTime: '12:00', endTime: '14:00' },
    { date: dateStr, startTime: '14:00', endTime: '16:00' },
    { date: dateStr, startTime: '16:00', endTime: '18:00' },
  ];
}

/**
 * Interpret slot wall-clock times as Lagos local time and return true UTC
 * instants. Example: { date: '2026-09-08', startTime: '09:00' } ->
 * 2026-09-08T08:00:00Z.
 */
export function parseSlotToDateTime(slot: Slot): DateTimeSlot {
  if (!isValidDateString(slot.date) || !isValidTimeString(slot.startTime) || !isValidTimeString(slot.endTime)) {
    throw new Error(`Invalid slot: ${slot.date} ${slot.startTime}-${slot.endTime}`);
  }

  const start = fromZonedTime(`${slot.date}T${slot.startTime}:00`, BUSINESS_TIMEZONE);
  const end = fromZonedTime(`${slot.date}T${slot.endTime}:00`, BUSINESS_TIMEZONE);

  return { ...slot, start, end };
}

/**
 * Booking window: an appointment may start between now and one month from now
 * (true instants on both sides).
 */
export function isWithinBookingWindow(date: Date): boolean {
  const now = new Date();
  const oneMonthFromNow = addMonths(now, 1);
  return isWithinInterval(date, { start: now, end: oneMonthFromNow });
}

/**
 * Same-day rule: the appointment start must be at least 1 hour after the
 * current time. Lagos has a fixed UTC+1 offset (no DST), so comparing true
 * instants is exactly equivalent to comparing Lagos clock times.
 */
export function validateSameDayBooking(slotStart: Date): boolean {
  return !isBefore(slotStart, addHours(new Date(), 1));
}

export function getBookingWindowStart(): Date {
  return new Date();
}

export function getBookingWindowEnd(): Date {
  return addMonths(new Date(), 1);
}

export function getOneHourFromNow(): Date {
  return addHours(new Date(), 1);
}

/**
 * Cancellation deadline: 1 hour before the appointment start.
 * Customers may cancel any time strictly before this instant.
 */
export function getCancellationDeadline(slot: Pick<Slot, 'date' | 'startTime'>): Date {
  const { start } = parseSlotToDateTime({ ...slot, endTime: slot.startTime });
  return new Date(start.getTime() - 60 * 60 * 1000);
}

export function formatSlotDisplay(slot: Slot): string {
  return `${slot.startTime} - ${slot.endTime}`;
}

export function slotToKey(slot: Slot): string {
  return `${slot.date}-${slot.startTime}-${slot.endTime}`;
}

export function parseSlotKey(key: string): Slot | null {
  const parts = key.split('-');
  if (parts.length !== 5) return null;

  const date = parts.slice(0, 3).join('-');
  const startTime = parts[3];
  const endTime = parts[4];

  if (!isValidDateString(date)) return null;
  if (!isValidTimeString(startTime)) return null;
  if (!isValidTimeString(endTime)) return null;

  return { date, startTime, endTime };
}

export function getHoursFromNow(date: Date): number {
  return differenceInMinutes(date, new Date()) / 60;
}

export function isSlotExpired(slot: Slot): boolean {
  const slotDateTime = parseSlotToDateTime(slot);
  return isAfter(new Date(), slotDateTime.end);
}

export function isSlotOccurringNow(slot: Slot): boolean {
  const slotDateTime = parseSlotToDateTime(slot);
  const now = new Date();
  return isBefore(now, slotDateTime.end) && isAfter(now, slotDateTime.start);
}

export function formatDateForDisplay(date: Date): string {
  return format(toLagosTime(date), 'EEEE, MMMM d, yyyy');
}

export function formatTimeForDisplay(date: Date): string {
  return format(toLagosTime(date), 'h:mm a');
}

export function getCurrentLagosDate(): string {
  return format(getLagosTime(), 'yyyy-MM-dd');
}
