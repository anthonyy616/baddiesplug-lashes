import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isReschedulable, canTransition } from '@/lib/booking/lifecycle';
import { recordBookingEvent } from '@/lib/booking/audit';

/**
 * Regression coverage for P0-1: admin reschedule redesign, and the reschedule
 * portion of the required suite (items 1-5).
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('reschedule lifecycle policy (P0-1)', () => {
  it('permits rescheduling from confirmed and approved', () => {
    expect(isReschedulable('confirmed')).toBe(true);
    expect(isReschedulable('approved')).toBe(true);
  });

  it('does NOT permit rescheduling from pending (policy decision)', () => {
    expect(isReschedulable('pending')).toBe(false);
  });

  it('does not permit rescheduling from terminal or legacy outcome statuses', () => {
    for (const s of ['ignored', 'cancelled', 'rejected', 'completed', 'no_show']) {
      expect(isReschedulable(s)).toBe(false);
    }
  });

  it('reschedule is NOT part of the normal transition matrix (separate command)', () => {
    expect(canTransition('confirmed', 'rescheduled' as never)).toBe(false);
    // The route never calls canTransition for reschedule
    const route = read('src/app/api/admin/bookings/[id]/route.ts');
    const fnStart = route.indexOf('async function handleReschedule');
    const fnBody = route.slice(fnStart, route.indexOf('export async function GET'));
    expect(fnBody).not.toContain('canTransition');
  });
});

describe('reschedule command flow (P0-1 / Stage 4 V2)', () => {
  // Stage 4: the reschedule implementation moved from the API route into the
  // shared domain command src/lib/booking/reschedule.ts; the route is a thin
  // adapter. The structural contract is asserted against the domain module.
  const handler = () => read('src/lib/booking/reschedule.ts');

  it('the API route delegates to the shared domain command', () => {
    const src = read('src/app/api/admin/bookings/[id]/route.ts');
    expect(src).toContain('adminRescheduleBooking');
    // The route no longer contains its own transactional reschedule logic
    expect(src).not.toContain('previousBookingId: id');
  });

  it('runs reschedule through a dedicated command, not the status-update path', () => {
    const src = read('src/app/api/admin/bookings/[id]/route.ts');
    const fnStart = src.indexOf('export async function PATCH');
    const patchBody = src.slice(fnStart, src.indexOf('const ALLOWED_ACTION_SOURCES'));
    expect(patchBody).toContain("if (action === 'reschedule')");
    expect(patchBody).toContain('handleReschedule');
    // TARGET_STATUS must not include reschedule
    const targetIdx = src.indexOf('const TARGET_STATUS');
    const targetBody = src.slice(targetIdx, src.indexOf('};', targetIdx));
    expect(targetBody).not.toContain('reschedule');
  });

  it('validates the new slot BEFORE mutating the original booking', () => {
    const body = handler();
    expect(body).toContain('validateAdminSlot');
    expect(body.indexOf('validateAdminSlot')).toBeLessThan(body.indexOf('db.transaction'));
    expect(body.indexOf('validateAdminSlot')).toBeLessThan(body.indexOf("status: 'cancelled'"));
  });

  it('guards the original-booking cancel on its current status (concurrency)', () => {
    const body = handler();
    const cancelIdx = body.indexOf("set({ status: 'cancelled'");
    const whereBody = body.slice(cancelIdx, cancelIdx + 500);
    expect(whereBody).toContain("eq(bookings.status, booking.status)");
  });

  it('preserves approval state: approved originals create approved replacements', () => {
    const body = handler();
    expect(body).toContain("booking.status === 'approved' ? 'approved' : 'confirmed'");
  });

  it('creates exactly one replacement, linked to the original', () => {
    const body = handler();
    expect(body).toContain('previousBookingId: bookingId');
    // Exactly one insert of a new booking
    expect(body.match(/await tx\.insert\(bookings\)/g)?.length).toBe(1);
  });

  it('copies service and add-on snapshots and preserves pricing', () => {
    const body = handler();
    expect(body).toContain('serviceNameSnapshot: s.serviceNameSnapshot');
    expect(body).toContain('unitPriceSnapshot: s.unitPriceSnapshot');
    expect(body).toContain('addonNameSnapshot: a.addonNameSnapshot');
    expect(body).toContain('subtotal: booking.subtotal');
    expect(body).toContain('depositRequired: booking.depositRequired');
    expect(body).toContain('total: booking.total');
  });

  it('records immutable audit events on BOTH bookings (links both records)', () => {
    const body = handler();
    expect(body.match(/recordBookingEvent/g)?.length).toBeGreaterThanOrEqual(2);
    expect(body).toContain("eventType: 'rescheduled'");
    expect(body).toContain("eventType: 'created'");
    expect(body).toContain('relatedBookingId: newBookingId');
  });

  it('queues exactly one customer reschedule email with old AND new appointment data', () => {
    const body = handler();
    expect(body.match(/queueEmailEvent\(/g)?.length).toBe(1);
    expect(body).toContain("eventType: 'booking.rescheduled'");
    expect(body).toContain('previousDate: booking.appointmentDate');
    expect(body).toContain('previousStartTime: booking.startTime');
    expect(body).toContain('wasApproved');
  });

  it('returns 409 on concurrency conflict and 400 on slot validation failure', () => {
    const body = handler();
    expect(body).toContain('ConcurrencyConflictError');
    expect(body).toContain('SlotValidationError');
  });

  it('accepts and persists an optional customer-safe reason (Stage 4)', () => {
    const body = handler();
    expect(body).toContain('reason?: string');
    expect(body).toContain('...(reason ? { reason } : {})');
  });

  it('dispatches email events only after the transaction commits', () => {
    const body = handler();
    const txEnd = body.indexOf('});', body.indexOf('queueEmailEvent'));
    const dispatchIdx = body.indexOf('dispatchEmailEvent(eventId)');
    expect(dispatchIdx).toBeGreaterThan(txEnd);
  });
});

describe('admin custom-time slot validation (P1 item 9 decision)', () => {
  it('provides an admin-only validator separate from the customer path', () => {
    const src = read('src/lib/availability/index.ts');
    expect(src).toContain('export async function validateAdminSlot');
  });

  it('enforces format, duration bounds, business hours, and overlap checks', () => {
    const src = read('src/lib/availability/index.ts');
    const fnStart = src.indexOf('export async function validateAdminSlot');
    const fnBody = src.slice(fnStart, src.indexOf('/**', fnStart + 10));
    expect(fnBody).toContain('end_before_start');
    expect(fnBody).toContain('duration_too_short');
    expect(fnBody).toContain('duration_too_long');
    expect(fnBody).toContain('outside_business_hours');
    expect(fnBody).toContain('overlaps_existing_booking');
    expect(fnBody).toContain("'blocked'");
  });

  it('excludes the booking being rescheduled from the overlap check', () => {
    const src = read('src/lib/availability/index.ts');
    const fnStart = src.indexOf('export async function validateAdminSlot');
    const fnBody = src.slice(fnStart, src.indexOf('/**', fnStart + 10));
    expect(fnBody).toContain('excludeBookingId');
  });

  it('accepts custom times (not restricted to the standard slot template)', () => {
    const src = read('src/lib/availability/index.ts');
    const fnStart = src.indexOf('export async function validateAdminSlot');
    const fnBody = src.slice(fnStart, src.indexOf('/**', fnStart + 10));
    expect(fnBody).not.toContain('slot_not_offered');
  });
});

describe('audit event recorder', () => {
  it('appends to booking_event with actor and metadata', () => {
    const src = read('src/lib/booking/audit.ts');
    expect(src).toContain("insert(bookingEvent)");
    expect(src).toContain('actorType');
    expect(src).toContain('relatedBookingId');
    expect(src).toContain('metadata');
  });

  it('exported recordBookingEvent is usable with a tx handle', async () => {
    expect(typeof recordBookingEvent).toBe('function');
  });
});

describe('customer reschedule availability cache', () => {
  // Stage 1 policy: customers cannot reschedule their own appointments.
  // The former customer-side rescheduleBooking() mutation was removed; the
  // admin reschedule command owns both cache invalidations (old + new date).
  it('no customer-side reschedule mutation exists (Stage 1 policy)', () => {
    const src = read('src/lib/booking/index.ts');
    expect(src).not.toContain('export async function rescheduleBooking');
  });

  it('the admin reschedule command invalidates both the released and replacement dates', () => {
    const src = read('src/lib/booking/reschedule.ts');
    const transactionStart = src.indexOf('await db.transaction');
    const oldDateInvalidation = src.indexOf('invalidateAvailabilityCache(booking.appointmentDate)');
    const newDateInvalidation = src.indexOf('invalidateAvailabilityCache(newDate)');

    expect(oldDateInvalidation).toBeGreaterThan(transactionStart);
    expect(newDateInvalidation).toBeGreaterThan(transactionStart);
  });
});
