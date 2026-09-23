/**
 * Pure logic for the booking calendar's date fetching strategy.
 * Extracted from DateTimePicker so it can be regression-tested.
 *
 * Terminology matches src/lib/timezone.ts: dates are local calendar
 * date strings (YYYY-MM-DD) in the browser's local timezone.
 */

export interface CalendarDayInfo {
  /** Local date string, e.g. "2026-09-24" */
  dateStr: string;
  dayOfWeek: number; // 0=Sunday … 6=Saturday
}

export const BOOKABLE_DOW_MIN = 2; // Tuesday
export const BOOKABLE_DOW_MAX = 5; // Friday

/**
 * Pick which days of the visible month to pre-fetch availability for.
 *
 * Regression note (2026-09): this previously took the FIRST 12 business days
 * of the month without skipping past dates. Late in a month, the cap was
 * entirely consumed by already-past days, so the remaining bookable days were
 * never fetched and the UI showed "No times available" for dates that were
 * actually open.
 *
 * Rules:
 * - Only bookable business days (Tue–Fri) are considered.
 * - Past dates (relative to `today`) are filtered out BEFORE the cap is
 *   applied, so the cap is always spent on days a customer could actually book.
 * - If the whole month is in the past, returns [].
 */
export function pickPrefetchDates(
  monthDays: CalendarDayInfo[],
  today: string,
  cap: number = 12,
): string[] {
  const bookable = monthDays
    .filter(
      (d) =>
        d.dayOfWeek >= BOOKABLE_DOW_MIN &&
        d.dayOfWeek <= BOOKABLE_DOW_MAX &&
        d.dateStr >= today,
    )
    .map((d) => d.dateStr);
  return bookable.slice(0, cap);
}

/**
 * Decide what the slots section should show for the selected date.
 * Mirrors the UI's three states so tests can pin the behavior:
 * - 'loading'  → fetch in flight and no data yet
 * - 'empty'    → data loaded and there are no slots (shows the
 *                "No times available" message)
 * - 'ready'    → render the slot list
 */
export type SlotsSectionState = 'loading' | 'empty' | 'ready';

export function getSlotsSectionState(
  slots: readonly unknown[] | undefined,
  isLoading: boolean,
): SlotsSectionState {
  if (!slots && isLoading) return 'loading';
  if (!slots || slots.length === 0) return 'empty';
  return 'ready';
}
