import type { BookingStatus } from '@/types';

/**
 * Booking status lifecycle — single source of truth.
 *
 * Lifecycle (agreed):
 * - New bookings are created as 'confirmed' (auto-approved for compatibility).
 * - Admin manually moves 'confirmed' -> 'approved' after reviewing payment proof.
 * - Admin manually marks 'confirmed' | 'approved' -> 'no_show'.
 * - The scheduled job NEVER creates 'no_show'.
 * - The scheduled job auto-moves untouched, past 'confirmed' bookings to 'ignored'.
 * - 'ignored' bookings stay visible in admin history, are hidden from customers,
 *   and release their time slot.
 * - Legacy production statuses ('pending', 'cancelled', 'rejected', 'completed',
 *   'no_show') remain valid and readable.
 */
export const BOOKING_STATUSES: readonly BookingStatus[] = [
  'pending',
  'confirmed',
  'approved',
  'ignored',
  'no_show',
  'completed',
  'cancelled',
  'rejected',
] as const;

/**
 * Statuses that occupy an appointment slot. These mirror the partial unique
 * index `active_booking_slot_unique` (pending/confirmed/approved) — keep the
 * two in sync. Every other status releases the slot.
 */
export const SLOT_OCCUPYING_STATUSES: readonly BookingStatus[] = [
  'pending',
  'confirmed',
  'approved',
] as const;

/** Terminal statuses — no further transitions are allowed. */
export const TERMINAL_STATUSES: readonly BookingStatus[] = [
  'completed',
  'cancelled',
  'rejected',
  'ignored',
] as const;

/**
 * Legal status transitions. Anything not listed here must be rejected by the
 * API. Legacy statuses keep their existing behavior; 'approved' behaves like
 * 'confirmed' for admin outcome actions.
 */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['approved', 'no_show', 'completed', 'cancelled'],
  approved: ['no_show', 'completed', 'cancelled'],
  ignored: [], // terminal: admin history only
  no_show: [], // terminal: manually assigned outcome
  completed: [],
  cancelled: [],
  rejected: [],
};

/** True if `from -> to` is a legal transition. */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** True if the status occupies an appointment slot (blocks re-booking). */
export function occupiesSlot(status: BookingStatus | string): boolean {
  return (SLOT_OCCUPYING_STATUSES as readonly string[]).includes(status);
}

/** True if the booking has reached a terminal state. */
export function isTerminal(status: BookingStatus | string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

/**
 * Customer-visible statuses. Customers see upcoming pending/confirmed/approved
 * bookings and their own cancellations. 'ignored' (and other history) is
 * hidden from customers per requirements — admin retains full history.
 */
export function isCustomerVisible(status: BookingStatus | string): boolean {
  return (
    status === 'pending' ||
    status === 'confirmed' ||
    status === 'approved' ||
    status === 'cancelled'
  );
}

/** True for statuses whose totals count as revenue. */
export function isRevenueStatus(status: BookingStatus | string): boolean {
  return status === 'approved' || status === 'completed';
}

/**
 * Statuses counted for engagement metrics (service popularity, peak times,
 * repeat customers) — includes legacy 'confirmed' for backward compatibility.
 */
export const ENGAGEMENT_STATUSES: readonly BookingStatus[] = [
  'pending',
  'confirmed',
  'approved',
  'completed',
] as const;

/** Display label for a status (used by badges and CSV export). */
export function statusLabel(status: BookingStatus | string): string {
  switch (status) {
    case 'no_show':
      return 'no-show';
    case 'ignored':
      return 'ignored';
    default:
      return status;
  }
}
