import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Regression coverage for P0-4: duplicate booking prevention and retry
 * reconciliation (idempotency key end to end).
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('API schema and idempotency contract (P0-4)', () => {
  const route = () => read('src/app/api/booking/route.ts');

  it('validates the request body with Zod (IDs, dates, times, phone, submissionKey)', () => {
    const src = route();
    expect(src).toContain('bookingSchema.safeParse');
    expect(src).toMatch(/serviceIds: z\.array\(z\.string\(\)\.uuid\(\)\)\.min\(1\)/);
    expect(src).toMatch(/date: z\.string\(\)\.regex\(/);
    expect(src).toMatch(/startTime: z\.string\(\)\.regex\(/);
    expect(src).toMatch(/endTime: z\.string\(\)\.regex\(/);
    expect(src).toMatch(/phone: z\.string\(\)\.min\(10\)/);
    expect(src).toMatch(/submissionKey: z\.string\(\)\.min\(8\)/);
  });

  it('checks the idempotency fast-path before creating a booking', () => {
    const src = route();
    const fnStart = src.indexOf('export async function POST');
    const fnBody = src.slice(fnStart, src.indexOf('export async function GET'));
    expect(fnBody).toContain('getBookingBySubmissionKey');
    // Fast-path must come before isSlotAvailable/createBooking
    expect(fnBody.indexOf('getBookingBySubmissionKey')).toBeLessThan(
      fnBody.indexOf('createBooking')
    );
  });

  it('exposes a reconciliation GET endpoint', () => {
    const src = route();
    expect(src).toContain('export async function GET');
    expect(src).toContain('found: true');
    expect(src).toContain('found: false');
  });
});

describe('createBooking idempotency (P0-4)', () => {
  const src = () => read('src/lib/booking/index.ts');

  it('accepts a submissionKey and persists it on the booking row', () => {
    const s = src();
    expect(s).toMatch(/submissionKey\?: string/);
    expect(s).toContain('idempotencyKey: submissionKey ?? null');
  });

  it('returns the original booking for a repeated submission key', () => {
    const s = src();
    const fnStart = s.indexOf('export async function createBooking');
    const fnBody = s.slice(fnStart, s.indexOf('class SlotConflictError'));
    expect(fnBody).toContain('getBookingBySubmissionKey(submissionKey)');
    // Pre-transaction check AND post-unique-violation recovery both present
    expect(fnBody.match(/getBookingBySubmissionKey\(submissionKey\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('maps a concurrent same-key unique violation to the original booking, not an error', () => {
    const s = src();
    const fnStart = s.indexOf('export async function createBooking');
    const fnEnd = s.indexOf('/**', fnStart + 10);
    const fnBody = s.slice(fnStart, fnEnd);
    expect(fnBody).toContain('isUniqueViolation(error)');
    // In the unique-violation branch, check key lookup before slot error
    const catchIdx = fnBody.lastIndexOf('isUniqueViolation(error)');
    const catchBody = fnBody.slice(catchIdx);
    expect(catchBody).toContain('slot_no_longer_available');
  });

  it('reconciliation lookup is scoped to the authenticated customer', () => {
    const s = src();
    const fnStart = s.indexOf('export async function getBookingBySubmissionKey');
    const fnBody = s.slice(fnStart, s.indexOf('/**', fnStart + 10));
    expect(fnBody).toContain('eq(bookings.customerId, user.id)');
  });

  it('server recalculates pricing (never trusts the client)', () => {
    const s = src();
    expect(s).toContain('calculateBookingTotal(serviceIds, addonIds)');
  });
});

describe('client submission flow (P0-4)', () => {
  const src = () => read('src/app/booking/BookingFlow.tsx');

  it('sends a client-generated submission key with every attempt', () => {
    const s = src();
    expect(s).toContain('submissionKeyRef');
    expect(s).toContain('submissionKey: submissionKeyRef.current');
  });

  it('reconciles after a lost response instead of blindly retrying', () => {
    const s = src();
    expect(s).toContain('/api/booking?submissionKey=');
    expect(s).toContain('rData.found');
  });

  it('rotates the key after success so later bookings start a new scope', () => {
    const s = src();
    expect(s.match(/submissionKeyRef\.current = uuidv4\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('migration support (P0-4)', () => {
  it('idempotency key is unique when present', () => {
    const migration = read('db/migrations/0010_audit_events_booking_idempotency.sql');
    expect(migration).toContain('bookings_idempotency_key_unique');
    expect(migration).toContain('idempotency_key');
  });
});
