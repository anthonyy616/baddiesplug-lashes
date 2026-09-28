import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  validateEmailPayload,
  emailPayloadSchemas,
} from '@/lib/email/payloads';

/**
 * Regression coverage for P0-2 (email queueing transaction safety + atomic
 * claim) and P0-3 (approval emails omit pricing fields).
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const validPricedPayload = {
  customerName: 'Ada',
  reference: 'BP-TEST-001',
  date: '2026-10-01',
  startTime: '10:00',
  endTime: '11:00',
  services: ['Classic Set'],
  addons: ['Wispy'],
  total: 2500000,
  depositRequired: 1250000,
};

describe('email payload schemas (P0-3)', () => {
  it('registers a schema for every email event type', () => {
    const types: string[] = [
      'booking.requested',
      'booking.confirmed',
      'booking.admin_new',
      'booking.customer_cancelled',
      'booking.admin_cancelled',
      'booking.rescheduled',
      'appointment.reminder',
    ];
    for (const t of types) {
      expect(emailPayloadSchemas).toHaveProperty(t);
    }
  });

  it('accepts a priced payload with total and depositRequired', () => {
    const result = validateEmailPayload('booking.confirmed', validPricedPayload);
    expect(result.ok).toBe(true);
  });

  it('REJECTS a booking.confirmed payload missing total/depositRequired (no silent ₦0.00)', () => {
    const { total, depositRequired, ...withoutPricing } = validPricedPayload;
    const result = validateEmailPayload('booking.confirmed', withoutPricing);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('total');
      expect(result.error).toContain('depositRequired');
    }
  });

  it('rejects negative or fractional money values', () => {
    expect(validateEmailPayload('booking.confirmed', { ...validPricedPayload, total: -1 }).ok).toBe(false);
    expect(validateEmailPayload('booking.confirmed', { ...validPricedPayload, total: 10.5 }).ok).toBe(false);
  });

  it('rejects malformed dates and times', () => {
    expect(validateEmailPayload('booking.confirmed', { ...validPricedPayload, date: '10/01/2026' }).ok).toBe(false);
    expect(validateEmailPayload('booking.confirmed', { ...validPricedPayload, startTime: '25:00' }).ok).toBe(false);
  });

  it('validates rescheduled payloads including old appointment + approval state', () => {
    const payload = {
      customerName: 'Ada',
      reference: 'BP-NEW-002',
      previousReference: 'BP-OLD-001',
      date: '2026-10-02',
      startTime: '12:00',
      endTime: '13:00',
      previousDate: '2026-10-01',
      previousStartTime: '10:00',
      previousEndTime: '11:00',
      wasApproved: true,
      services: ['Classic Set'],
    };
    expect(validateEmailPayload('booking.rescheduled', payload).ok).toBe(true);
    expect(validateEmailPayload('booking.rescheduled', { ...payload, previousReference: '' }).ok).toBe(false);
  });
});

describe('queueEmailEvent transaction safety (P0-2)', () => {
  it('accepts an optional transaction handle as second argument', () => {
    const src = read('src/lib/email/events.ts');
    expect(src).toMatch(/export async function queueEmailEvent\(\s*input: QueueEmailInput,\s*tx\?: TxLike/);
  });

  it('inserts via the tx handle when provided (no global db write inside transactions)', () => {
    const src = read('src/lib/email/events.ts');
    const fnStart = src.indexOf('export async function queueEmailEvent');
    const fnBody = src.slice(fnStart, src.indexOf('}', src.indexOf('scheduledFor: input.scheduledFor')));
    expect(fnBody).toContain('const client = tx ?? db');
  });

  it('refuses to queue an invalid payload (throws so the transaction rolls back)', () => {
    const src = read('src/lib/email/events.ts');
    const fnStart = src.indexOf('export async function queueEmailEvent');
    const fnEnd = src.indexOf('export', fnStart + 10);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toContain('validateEmailPayload');
    expect(fnBody).toContain('throw new Error');
  });
});

describe('dispatch-after-commit (P0-2)', () => {
  it('booking and admin routes dispatch via getDispatchableEventIds, not inline db queries', () => {
    const bookingSrc = read('src/lib/booking/index.ts');
    expect(bookingSrc).toContain('getDispatchableEventIds');
    expect(bookingSrc).not.toMatch(/\.select\(\{ id: emailEvents\.id \}\)/);

    const adminSrc = read('src/app/api/admin/bookings/[id]/route.ts');
    expect(adminSrc).toContain('getDispatchableEventIds');
    // Reschedule dispatch must include the NEW booking id too
    expect(adminSrc).toContain('newBookingId');
  });
});

describe('atomic claim / lease (P0-2)', () => {
  it('processEmailEvent claims via guarded pending|stale-processing -> processing update', () => {
    const src = read('src/lib/email/events.ts');
    const fnStart = src.indexOf('export async function processEmailEvent');
    const fnBody = src.slice(fnStart, src.indexOf('export function dispatchEmailEvent'));
    expect(fnBody).toContain("'pending'");
    expect(fnBody).toContain("'processing'");
    expect(fnBody).toContain('LEASE_MS');
  });

  it('finalize is guarded on status=processing (only the claim holder marks sent)', () => {
    const src = read('src/lib/email/events.ts');
    expect(src).toMatch(/eq\(emailEvents\.status, 'processing'\)/);
  });

  it('has a lease window constant', () => {
    const src = read('src/lib/email/events.ts');
    expect(src).toMatch(/const LEASE_MS = /);
  });

  it('render-time validation fails invalid payloads instead of rendering zero', () => {
    const src = read('src/lib/email/events.ts');
    const fnStart = src.indexOf('export async function processEmailEvent');
    const fnEnd = src.indexOf('export function dispatchEmailEvent');
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toContain('validateEmailPayload');
  });

  it('exposes failed events for the admin view', () => {
    const src = read('src/lib/email/events.ts');
    expect(src).toContain('export async function listFailedEmailEvents');
  });
});
