import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('Analytics V2 metric definitions (Stage 7)', () => {
  const src = () => read('src/lib/analytics/v2.ts');

  it('lives in a dedicated module that extends (not replaces) the existing analytics', () => {
    expect(src()).toContain('export async function getAnalyticsV2');
    // Existing page remains intact and imports V2 on top of it.
    const page = read('src/app/admin/analytics/page.tsx');
    expect(page).toContain('getAnalyticsV2');
    expect(page).toContain('Most Popular Services'); // existing section kept
  });

  it('defines date ranges explicitly on appointmentDate (Lagos dates)', () => {
    const s = src();
    expect(s).toContain('export interface AnalyticsRange');
    expect(s).toMatch(/gte\(bookings\.appointmentDate/);
    expect(s).toMatch(/lte\(bookings\.appointmentDate/);
  });

  it('revenue definition: approved + completed booking totals only', () => {
    const s = src();
    expect(s).toMatch(/REVENUE_STATUSES[^=]*= \['approved', 'completed'\]/);
  });

  it('outcome denominator excludes rejected/ignored bookings', () => {
    const s = src();
    expect(s).toMatch(/OUTCOME_DENOMINATOR[^=]*= \[[\s\S]*?'completed',[\s\S]*?'cancelled',[\s\S]*?'no_show',?[\s\S]*?\]/);
    const outcomeFn = s.slice(s.indexOf('async function getOutcomes'), s.indexOf('async function getCustomerStats'));
    expect(outcomeFn).toContain('denominator: completed + cancelled + noShow');
  });

  it('rates return null (never a misleading 0%) when the denominator is empty', () => {
    const s = src();
    expect(s).toMatch(/denominator <= 0\) return null/);
  });

  it('repeat-customer definition: >= 2 engagement bookings in range', () => {
    const s = src();
    expect(s).toMatch(/Number\(r\.count\) >= 2/);
  });

  it('engagement metrics reuse the shared lifecycle list (no ad-hoc status lists)', () => {
    const s = src();
    expect(s).toContain("ENGAGEMENT_STATUSES");
    expect(s).toContain("from '@/lib/booking/lifecycle'");
  });

  it('cancellation reasons read the durable audit trail (Stage 5 source of truth)', () => {
    const s = src();
    const fn = s.slice(s.indexOf('async function getCancellationReasons'));
    expect(fn).toContain("eq(bookingEvent.eventType, 'cancelled')");
    expect(fn).toContain('analytics_cancellation_reason');
    expect(fn).toContain("'unspecified'");
  });

  it('utilization uses the same standard slot template as the booking flow', () => {
    const s = src();
    expect(s).toContain('standardTemplateHours');
    expect(s).toMatch(/Tuesday[\s\S]*Friday/);
    // Booked hours use slot-occupying statuses.
    const util = s.slice(s.indexOf('async function getSlotUtilization'));
    expect(util).toMatch(/'pending', 'confirmed', 'approved', 'completed'/);
  });

  it('booking source metric consumes the Stage 2 booking_source column', () => {
    const s = src();
    expect(s).toContain('bookings.bookingSource');
  });

  it('prepares the discount/loyalty shape for Stage 10 without inventing data', () => {
    const s = src();
    expect(s).toContain('getDiscountImpact');
    expect(s).toContain('bookingsWithDiscount');
    expect(s).toContain('totalDiscount');
  });

  it('queries are aggregate-first (count/sum/groupBy in SQL, not full-table scans in JS)', () => {
    const s = src();
    expect(s.match(/sql<number>`count\(\*\)`/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(s).toContain('groupBy');
    // No unbounded findMany over bookings.
    expect(s).not.toMatch(/query\.bookings\.findMany/);
  });
});

describe('Analytics V2 admin UI (Stage 7)', () => {
  it('surfaces the new metrics with their definitions visible', () => {
    const s = read('src/app/admin/analytics/page.tsx');
    expect(s).toContain('Cancellation Rate');
    expect(s).toContain('No-Show Rate');
    expect(s).toContain('Repeat-Customer Rate');
    expect(s).toContain('Cancellation Reasons');
    expect(s).toContain('Booking Source');
    expect(s).toContain('Slot Utilization');
    expect(s).toContain('Common Service Combinations');
    expect(s).toMatch(/Definitions:/);
  });
});
