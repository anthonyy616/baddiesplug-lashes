import { format, addHours, addMonths, isWithinInterval, isBefore, isAfter, parse, differenceInMinutes, startOfDay, endOfDay, set } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const BUSINESS_TIMEZONE = 'Africa/Lagos' as const;

export { BUSINESS_TIMEZONE };

export function getLagosTime(date: Date = new Date()): Date {
  return toZonedTime(date, BUSINESS_TIMEZONE);
}

export function toLagosTime(date: Date): Date {
  return toZonedTime(date, BUSINESS_TIMEZONE);
}

export function fromLagosTime(date: Date): Date {
  return fromZonedTime(date, BUSINESS_TIMEZONE);
}

export function formatLagosTime(date: Date, formatStr: string): string {
  const lagosDate = toLagosTime(date);
  return format(lagosDate, formatStr);
}

export function isBusinessDay(date: Date): boolean {
  const lagosDate = toLagosTime(date);
  const dayOfWeek = lagosDate.getDay();
  // Tuesday = 2, Wednesday = 3, Thursday = 4, Friday = 5
  return dayOfWeek >= 2 && dayOfWeek <= 5;
}

export function isOpenDay(date: Date): boolean {
  return isBusinessDay(date);
}

export interface Slot {
  date: string;
  startTime: string;
  endTime: string;
}

export interface DateTimeSlot extends Slot {
  start: Date;
  end: Date;
}

export function getStandardSlots(date: Date): Slot[] {
  if (!isBusinessDay(date)) {
    return [];
  }

  const lagosDate = toLagosTime(date);
  const formattedDate = format(lagosDate, 'yyyy-MM-dd');

  const slots: Slot[] = [
    { date: formattedDate, startTime: '09:00', endTime: '11:00' },
    { date: formattedDate, startTime: '12:00', endTime: '14:00' },
    { date: formattedDate, startTime: '14:00', endTime: '16:00' },
    { date: formattedDate, startTime: '16:00', endTime: '18:00' },
  ];

  return slots;
}

export function parseSlotToDateTime(slot: Slot): DateTimeSlot {
  const startDate = set(new Date(), {
    year: parseInt(slot.date.split('-')[0]),
    month: parseInt(slot.date.split('-')[1]) - 1,
    date: parseInt(slot.date.split('-')[2]),
    hours: parseInt(slot.startTime.split(':')[0]),
    minutes: parseInt(slot.startTime.split(':')[1]),
  });

  const endDate = set(new Date(), {
    year: parseInt(slot.date.split('-')[0]),
    month: parseInt(slot.date.split('-')[1]) - 1,
    date: parseInt(slot.date.split('-')[2]),
    hours: parseInt(slot.endTime.split(':')[0]),
    minutes: parseInt(slot.endTime.split(':')[1]),
  });

  // Convert to Lagos timezone
  const startInLagos = toZonedTime(startDate, BUSINESS_TIMEZONE);
  const endInLagos = toZonedTime(endDate, BUSINESS_TIMEZONE);

  return {
    ...slot,
    start: startInLagos,
    end: endInLagos,
  };
}

export function isWithinBookingWindow(date: Date): boolean {
  const now = getLagosTime();
  const oneMonthFromNow = addMonths(now, 1);

  return isWithinInterval(date, { start: now, end: oneMonthFromNow });
}

export function validateSameDayBooking(slotStart: Date): boolean {
  const now = getLagosTime();
  const oneHourFromNow = addHours(now, 1);

  return isAfter(slotStart, oneHourFromNow);
}

export function getBookingWindowStart(): Date {
  return getLagosTime();
}

export function getBookingWindowEnd(): Date {
  return addMonths(getLagosTime(), 1);
}

export function getOneHourFromNow(): Date {
  return addHours(getLagosTime(), 1);
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(startTime)) return null;
  if (!/^\d{2}:\d{2}$/.test(endTime)) return null;

  return { date, startTime, endTime };
}

export function getHoursFromNow(date: Date): number {
  const lagosDate = toLagosTime(date);
  const now = getLagosTime();
  return differenceInMinutes(lagosDate, now) / 60;
}

export function calculateAppointmentEnd(startTime: string, endTime: string): { hours: number; minutes: number } {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startTotalMinutes = startHour * 60 + startMin;
  const endTotalMinutes = endHour * 60 + endMin;

  const diffMinutes = endTotalMinutes - startTotalMinutes;

  return {
    hours: Math.floor(diffMinutes / 60),
    minutes: diffMinutes % 60,
  };
}

export function isSlotExpired(slot: Slot): boolean {
  const slotDateTime = parseSlotToDateTime(slot);
  const now = getLagosTime();
  return isAfter(now, slotDateTime.end);
}

export function isSlotOccurringNow(slot: Slot): boolean {
  const slotDateTime = parseSlotToDateTime(slot);
  const now = getLagosTime();
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
