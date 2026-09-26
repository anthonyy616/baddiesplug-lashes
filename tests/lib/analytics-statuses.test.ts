import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Analytics/export consistency tests. The plan requires the same status rules
 * everywhere:
 * - Revenue includes only approved and completed bookings.
 * - Engagement metrics (services, peak times, repeat customers) include
 *   confirmed for backward compatibility.
 * - Ignored and all statuses appear in admin analytics and export output.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('analytics page status rules', () => {
  const page = read('src/app/admin/analytics/page.tsx');

  it('shows separate counts for all statuses including approved and ignored', () => {
    expect(page).toContain("eq(bookings.status, 'approved')");
    expect(page).toContain("eq(bookings.status, 'ignored')");
    expect(page).toContain("eq(bookings.status, 'confirmed')");
    expect(page).toContain("eq(bookings.status, 'completed')");
    expect(page).toContain("eq(bookings.status, 'cancelled')");
    expect(page).toContain("eq(bookings.status, 'rejected')");
    expect(page).toContain("eq(bookings.status, 'no_show')");
  });

  it('computes revenue only from approved and completed bookings', () => {
    expect(page).toContain("inArray(bookings.status, ['approved', 'completed']");
  });

  it('labels confirmed metrics as not-manually-approved', () => {
    expect(page).toContain('Confirmed (auto, awaiting manual approval)');
  });

  it('uses the shared engagement statuses for popularity/peak/repeat metrics', () => {
    expect(page).toContain('ENGAGEMENT_STATUSES');
    // No local hardcoded eligible-status lists left behind
    expect(page).not.toMatch(/\['pending', 'confirmed', 'completed'\]/);
  });
});

describe('export route status rules', () => {
  const route = read('src/app/api/admin/analytics/export/route.ts');

  it('uses the shared engagement statuses (same rules as the page)', () => {
    expect(route).toContain('ENGAGEMENT_STATUSES');
    expect(route).not.toMatch(/\['pending', 'confirmed', 'completed'\]/);
  });

  it('exports every booking status (grouped by status includes approved/ignored)', () => {
    // Status rows are a groupBy over bookings.status — all statuses included.
    expect(route).toContain('groupBy(bookings.status)');
    expect(route).toContain("'Booking Status'");
  });
});

describe('admin bookings surface coverage', () => {
  it('admin bookings lib exposes approved and ignored queries', () => {
    const lib = read('src/lib/admin/bookings.ts');
    expect(lib).toContain('export async function approvedBookings');
    expect(lib).toContain('export async function ignoredBookings');
    expect(lib).toContain("eq(bookings.status, 'approved')");
    expect(lib).toContain("eq(bookings.status, 'ignored')");
  });

  it('admin bookings list page has Approved and Ignored filters and All includes ignored', () => {
    const page = read('src/app/admin/bookings/page.tsx');
    expect(page).toContain("status=approved");
    expect(page).toContain("status=ignored");
    expect(page).toContain('approvedBookings()');
    expect(page).toContain('ignoredBookings()');
    // All view includes ignored and historical rows
    expect(page).toContain('...ignored');
  });

  it('admin API transition matrix allows approve from confirmed and no-show from approved', () => {
    const route = read('src/app/api/admin/bookings/[id]/route.ts');
    expect(route).toContain("approve: ['pending', 'confirmed']");
    expect(route).toContain("no_show: ['confirmed', 'approved']");
    expect(route).toContain('canTransition');
    expect(route).toContain("approve: 'approved'");
  });
});

describe('customer visibility of ignored bookings', () => {
  it('customer booking list uses the shared visibility helper', () => {
    const booking = read('src/lib/booking/index.ts');
    expect(booking).toContain('isCustomerVisible');
  });

  it('lifecycle helper hides ignored from customers', async () => {
    const { isCustomerVisible } = await import('@/lib/booking/lifecycle');
    expect(isCustomerVisible('ignored')).toBe(false);
    expect(isCustomerVisible('approved')).toBe(true);
  });
});
