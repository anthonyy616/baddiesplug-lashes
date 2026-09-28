import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { invalidateAvailabilityCache } from '@/lib/availability';

/**
 * Regression coverage for P1 items 5-8 and 10:
 * 5. Customer booking counts internally consistent
 * 6. Guarded customer cancellation (409 on race)
 * 7. Ignored-booking cron cannot overwrite a racing admin approval
 * 8. Availability cache invalidated across requests
 * 10. Approved bookings receive reminders; cancelled/rescheduled suppressed
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('item 5: customer booking counts', () => {
  it('API uses typed count() with LEFT JOIN + GROUP BY and Number normalization', () => {
    const src = read('src/app/api/admin/customers/route.ts');
    expect(src).toContain('count(bookings.id)');
    expect(src).toContain('leftJoin(bookings, eq(bookings.customerId, users.id))');
    expect(src).toContain('groupBy(users.id)');
    expect(src).toContain('Number(r.bookingCount)');
    // The raw correlated subquery must be gone
    expect(src).not.toContain('sql<number>`(select count(*)');
  });

  it('admin page applies the same fix', () => {
    const src = read('src/app/admin/customers/page.tsx');
    expect(src).toContain('count(bookings.id)');
    expect(src).toContain('Number(c.bookingCount)');
    expect(src).not.toContain('sql<number>`(select count(*)');
  });

  it('count source matches the history query source (customerId = users.id)', () => {
    const api = read('src/app/api/admin/customers/route.ts');
    const history = read('src/app/api/admin/customers/route.ts');
    // Both count and history filter on the same join column
    expect(api).toContain('bookings.customerId, users.id');
    expect(history).toContain('eq(bookings.customerId, customerId)');
  });
});

describe('item 6: guarded customer cancellation', () => {
  it('lib cancel re-checks status in WHERE and requires exactly one affected row', () => {
    const src = read('src/lib/booking/index.ts');
    const fnStart = src.indexOf('export async function cancelBooking');
    const fnBody = src.slice(fnStart, src.indexOf('/**', fnStart + 10));
    expect(fnBody).toContain("eq(bookings.status, booking.status)");
    expect(fnBody).toContain('cancelled.length === 0');
    expect(fnBody).toContain('ConcurrencyConflictError');
  });

  it('account DELETE maps a lost race to 409', () => {
    const src = read('src/app/api/account/bookings/[id]/route.ts');
    expect(src).toContain("eq(bookings.status, booking.status)");
    expect(src).toMatch(/cancelled\.length === 0[\s\S]{0,300}status: 409/);
  });

  it('records a customer audit event on cancellation', () => {
    const src = read('src/lib/booking/index.ts');
    const fnStart = src.indexOf('export async function cancelBooking');
    const fnBody = src.slice(fnStart, src.indexOf('/**', fnStart + 10));
    expect(fnBody).toContain("actorType: 'customer'");
  });
});

describe('item 7: ignored-booking cron race safety', () => {
  it('update re-checks status = confirmed and counts affected rows', () => {
    const src = read('src/lib/jobs/index.ts');
    const fnStart = src.indexOf('export async function markIgnoredBookings');
    const fnBody = src.slice(fnStart, src.indexOf('/**', fnStart + 10));
    expect(fnBody).toMatch(/inArray\(bookings\.id, toIgnore\), eq\(bookings\.status, 'confirmed'\)/);
    expect(fnBody).toContain('.returning({ id: bookings.id })');
    expect(fnBody).toContain('ignored.length');
  });
});

describe('item 8: availability cache invalidation', () => {
  it('exposes an explicit invalidation function', () => {
    expect(typeof invalidateAvailabilityCache).toBe('function');
  });

  it('booking creation invalidates the cache for the booked date', () => {
    const src = read('src/lib/booking/index.ts');
    const fnStart = src.indexOf('export async function createBooking');
    const fnBody = src.slice(fnStart, fnStart + 9000);
    expect(fnBody).toContain('invalidateAvailabilityCache(date)');
  });

  it('customer cancellation invalidates the cache (slot released)', () => {
    const src = read('src/lib/booking/index.ts');
    const fnStart = src.indexOf('export async function cancelBooking');
    const fnBody = src.slice(fnStart, src.indexOf('/**', fnStart + 10));
    expect(fnBody).toContain('invalidateAvailabilityCache');
  });

  it('admin actions and reschedules invalidate both old and new dates', () => {
    const src = read('src/app/api/admin/bookings/[id]/route.ts');
    expect(src).toContain('invalidateAvailabilityCache(booking.appointmentDate)');
    expect(src).toContain('invalidateAvailabilityCache(newDate)');
  });

  it('availability route still clears the cache in finally', () => {
    const src = read('src/app/api/availability/route.ts');
    expect(src).toContain('clearRequestCache()');
  });
});

describe('item 10: reminders for approved bookings', () => {
  it('reminder selection includes confirmed AND approved', () => {
    const src = read('src/lib/jobs/index.ts');
    const fnStart = src.indexOf('export async function queueAppointmentReminders');
    const fnBody = src.slice(fnStart, src.indexOf('/**', fnStart + 10));
    expect(fnBody).toContain("inArray(bookings.status, ['confirmed', 'approved'])");
  });

  it('re-checks booking status immediately before sending and suppresses stale reminders', () => {
    const src = read('src/lib/jobs/index.ts');
    const fnStart = src.indexOf('export async function sendDueReminders');
    const fnBody = src.slice(fnStart, src.indexOf('/**', fnStart + 10));
    expect(fnBody).toContain('TERMINAL_OR_CANCELLED');
    expect(fnBody).toContain("findFirst");
    expect(fnBody).toContain('Booking cancelled or removed before reminder');
  });

  it('exposes cancelPendingReminders and calls it on cancel + reschedule', () => {
    const src = read('src/lib/jobs/index.ts');
    expect(src).toContain('export async function cancelPendingReminders');

    const bookingSrc = read('src/lib/booking/index.ts');
    expect(bookingSrc).toContain('cancelPendingReminders(bookingId)');

    const adminSrc = read('src/app/api/admin/bookings/[id]/route.ts');
    expect(adminSrc).toContain('cancelPendingReminders(id)');
  });
});
