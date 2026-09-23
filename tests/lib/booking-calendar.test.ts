import { describe, it, expect } from 'vitest';
import { pickPrefetchDates, getSlotsSectionState, type CalendarDayInfo } from '@/lib/booking-calendar';

/**
 * Regression tests for the Sep 2026 booking-calendar bug:
 *
 * The DateTimePicker pre-fetched availability for the FIRST 12 business days
 * of the visible month without excluding past dates. Late in the month the
 * cap was fully consumed by past days, so the remaining bookable days were
 * never fetched — the UI showed "No times available" for open dates while
 * every API request returned 200.
 */

const DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 } as const;

/** Build CalendarDayInfo for every day of a month. */
function month(year: number, month0: number): CalendarDayInfo[] {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const out: CalendarDayInfo[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month0, d);
    const dateStr = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    out.push({ dateStr, dayOfWeek: date.getDay() });
  }
  return out;
}

describe('pickPrefetchDates', () => {
  it('skips past dates BEFORE applying the cap (the original bug)', () => {
    // September 2026: Sept 1 is a Tuesday. Business days Sept 1–18 fill a
    // 12-day cap; the bug left the remaining bookable days after
    // "today" = Sept 22 (a Tuesday) unfetched.
    const sept2026 = month(2026, 8);
    const picked = pickPrefetchDates(sept2026, '2026-09-22');

    expect(picked).not.toContain('2026-09-01');
    expect(picked).not.toContain('2026-09-18');
    expect(picked[0]).toBe('2026-09-22');
    // Remaining bookable days of the month (Tue–Fri), in order
    expect(picked).toEqual([
      '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-29', '2026-09-30',
    ]);
  });

  it('caps at 12 bookable future days, not 12 business days total', () => {
    // A full future month: Oct 2026 starts Thursday Oct 1.
    const oct2026 = month(2026, 9);
    const picked = pickPrefetchDates(oct2026, '2026-09-23');

    expect(picked).toHaveLength(12);
    expect(picked[0]).toBe('2026-10-01');
    expect(picked.every((d) => d >= '2026-09-23')).toBe(true);
  });

  it('never includes weekends or Mondays', () => {
    const picked = pickPrefetchDates(month(2026, 8), '2026-09-23');
    const dowByDate = new Map(month(2026, 8).map((d) => [d.dateStr, d.dayOfWeek]));
    for (const dateStr of picked) {
      const dow = dowByDate.get(dateStr)!;
      expect(dow).toBeGreaterThanOrEqual(DOW.TU);
      expect(dow).toBeLessThanOrEqual(DOW.FR);
    }
  });

  it('returns [] when the whole month is in the past', () => {
    const picked = pickPrefetchDates(month(2026, 7), '2026-09-23'); // August 2026
    expect(picked).toEqual([]);
  });

  it('includes today itself', () => {
    const picked = pickPrefetchDates(month(2026, 8), '2026-09-24');
    expect(picked).toContain('2026-09-24');
  });
});

describe('getSlotsSectionState', () => {
  it('is loading while fetching and no data has arrived', () => {
    expect(getSlotsSectionState(undefined, true)).toBe('loading');
  });

  it('is empty when data arrived with no slots (shows the warning)', () => {
    expect(getSlotsSectionState([], false)).toBe('empty');
    expect(getSlotsSectionState([], true)).toBe('empty');
  });

  it('is empty when the date was never fetched and is not loading', () => {
    // This is the state the bug produced: silent "empty" instead of loading.
    expect(getSlotsSectionState(undefined, false)).toBe('empty');
  });

  it('is ready when slots exist', () => {
    expect(getSlotsSectionState([{ startTime: '09:00' }], false)).toBe('ready');
  });
});
