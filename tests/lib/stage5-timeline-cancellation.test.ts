import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('booking activity timeline (Stage 5)', () => {
  it('timeline is derived from the durable booking_event audit table (read-only projection)', () => {
    const src = read('src/lib/booking/timeline.ts');
    expect(src).toContain('bookingEvent');
    // Reads events, never mutates them (no insert/update/delete on the table).
    expect(src).not.toMatch(/\.insert\(bookingEvent\)/);
    expect(src).not.toMatch(/\.update\(bookingEvent\)/);
    expect(src).not.toMatch(/\.delete\(bookingEvent\)/);
  });

  it('provides separate admin and customer projections', () => {
    const src = read('src/lib/booking/timeline.ts');
    expect(src).toContain('export async function getAdminBookingTimeline');
    expect(src).toContain('export async function getCustomerBookingTimeline');
  });

  it('customer projection filters to customer-appropriate event types only', () => {
    const src = read('src/lib/booking/timeline.ts');
    const fnStart = src.indexOf('export async function getCustomerBookingTimeline');
    const fnBody = src.slice(fnStart, fnStart + 2500);
    expect(fnBody).toContain('CUSTOMER_EVENT_TYPES');
    expect(fnBody).toContain('.filter(');
  });

  it('customer projection never exposes admin actor ids or raw metadata', () => {
    const src = read('src/lib/booking/timeline.ts');
    // The shared projection helper attaches admin-only fields only for the
    // admin viewer; the customer path calls it with viewer 'customer'.
    expect(src).toContain("toTimelineEntry(row, 'customer')");
    expect(src).toMatch(/if \(viewer === 'admin'\)\s*\{[\s\S]*?actorId[\s\S]*?\}/);
    // Customer function must not attach raw metadata itself.
    const fnStart = src.indexOf('export async function getCustomerBookingTimeline');
    const fnBody = src.slice(fnStart);
    expect(fnBody).not.toContain('entry.metadata');
  });

  it('admin projection keeps full operational detail', () => {
    const src = read('src/lib/booking/timeline.ts');
    expect(src).toContain('relatedBookingId');
    expect(src).toContain('entry.metadata = metadata');
  });

  it('covers the required event vocabulary in labels/descriptions', () => {
    const src = read('src/lib/booking/timeline.ts');
    for (const eventType of [
      'created',
      'rescheduled',
      'cancelled',
      'approved',
      'payment_recorded',
      'reminder_sent',
      'cancelled',
      'completed',
      'no_show',
    ]) {
      expect(src).toContain(`'${eventType}'`);
    }
  });

  it('customer event-type constant list excludes internal-only types', () => {
    const src = read('src/types/index.ts');
    const listStart = src.indexOf('CUSTOMER_BOOKING_EVENT_TYPES');
    const listBody = src.slice(listStart, src.indexOf('] as const', listStart));
    expect(listBody).not.toContain('status_changed');
    expect(listBody).not.toContain('no_show');
    expect(listBody).not.toContain('reminder_sent');
    expect(listBody).toContain("'created'");
    expect(listBody).toContain("'rescheduled'");
    expect(listBody).toContain("'cancelled'");
    expect(listBody).toContain("'approved'");
    expect(listBody).toContain("'completed'");
    expect(listBody).toContain("'payment_recorded'");
  });

  it('admin booking detail page renders the timeline', () => {
    const src = read('src/app/admin/bookings/[id]/page.tsx');
    expect(src).toContain('getAdminBookingTimeline');
    expect(src).toContain('BookingActivityTimeline');
  });

  it('customer booking detail page renders the customer-safe timeline', () => {
    const src = read('src/app/account/bookings/[id]/page.tsx');
    expect(src).toContain('getCustomerBookingTimeline');
    expect(src).toContain('BookingActivityTimeline');
  });

  it('timeline component is shared between admin and customer views', () => {
    const src = read('src/components/booking/BookingActivityTimeline.tsx');
    expect(src).toContain("variant: 'admin' | 'customer'");
    expect(src).toContain('TimelineEntry');
  });
});

describe('payment recorded audit event (Stage 5)', () => {
  it("payment recording appends a 'payment_recorded' booking event", () => {
    const src = read('src/lib/payments/manual.ts');
    expect(src).toContain("eventType: 'payment_recorded'");
    expect(src).toContain('recordBookingEvent');
  });

  it('payment event records amount and type in metadata', () => {
    const src = read('src/lib/payments/manual.ts');
    const idx = src.indexOf("eventType: 'payment_recorded'");
    const body = src.slice(Math.max(0, idx - 600), idx + 400);
    expect(body).toContain('amount');
    expect(body).toContain('paymentType');
  });
});

describe('reminder sent audit event (Stage 5)', () => {
  it("successful reminder sends append a 'reminder_sent' booking event", () => {
    const src = read('src/lib/jobs/index.ts');
    expect(src).toContain("eventType: 'reminder_sent'");
    // Recorded only after the send succeeded.
    const sendIdx = src.indexOf('await processEmailEvent(event.id)');
    const auditIdx = src.indexOf("eventType: 'reminder_sent'");
    expect(auditIdx).toBeGreaterThan(sendIdx);
  });
});

describe('cancellation reasons (Stage 5)', () => {
  it('admin cancel action accepts an optional reason', () => {
    const src = read('src/app/api/admin/bookings/[id]/route.ts');
    expect(src).toContain('cancellationReason');
    expect(src).toMatch(/reason: z\.string\(\)\.max\(1000\)\.optional\(\)/);
  });

  it('persists the reason verbatim in the durable audit record', () => {
    const src = read('src/app/api/admin/bookings/[id]/route.ts');
    const auditIdx = src.indexOf('await recordBookingEvent');
    const body = src.slice(auditIdx, src.indexOf('},', src.indexOf('cancellationReason', auditIdx)));
    expect(body).toContain('reason: cancellationReason');
  });

  it('structures cancellation data for Analytics V2 consumption', () => {
    const src = read('src/app/api/admin/bookings/[id]/route.ts');
    expect(src).toContain('analytics_cancellation_reason');
    expect(src).toContain('analytics_cancelled_by');
    expect(src).toContain('analytics_reference');
  });

  it("cancellation email payload schema supports an optional 'reason'", () => {
    const src = read('src/lib/email/payloads.ts');
    const idx = src.indexOf("'booking.admin_cancelled'");
    const body = src.slice(idx, src.indexOf("'booking.rescheduled'", idx));
    expect(body).toContain('reason: z.string().max(1000).optional()');
  });

  it('email renders the admin-entered reason verbatim (no AI rewriting, no generic substitution)', () => {
    const src = read('src/lib/email/templates.ts');
    expect(src).toContain('<strong>Reason:</strong>');
    expect(src).toContain('escapeHtml(input.reason)');
    // Verbatim passthrough in the HTML renderer (search inside renderEmailHtml
    // — the subject switch also mentions the event type).
    const events = read('src/lib/email/events.ts');
    const renderStart = events.indexOf('function renderEmailHtml');
    const renderer = events.slice(renderStart);
    const idx = renderer.indexOf("'booking.admin_cancelled'");
    const body = renderer.slice(idx, renderer.indexOf('case', idx + 10));
    expect(body).toContain("str('reason')");
  });

  it('reason only renders for admin cancellations', () => {
    const src = read('src/lib/email/templates.ts');
    expect(src).toMatch(/input\.cancelledBy === 'admin' && input\.reason/);
  });

  it('email remains retryable through the existing durable email-event infrastructure', () => {
    const src = read('src/app/api/admin/bookings/[id]/route.ts');
    expect(src).toContain("queueEmailEvent(");
    expect(src).toContain('getDispatchableEventIds');
    expect(src).toContain('dispatchEmailEvent');
  });

  it('admin cancel UI collects an optional customer-safe reason', () => {
    const list = read('src/components/admin/BookingActions.tsx');
    expect(list).toContain('Reason shown to the customer');
    expect(list).toContain('reason: cancelReason.trim()');
    const detail = read('src/app/admin/bookings/[id]/BookingActionsClient.tsx');
    expect(detail).toContain('Reason shown to the customer');
    expect(detail).toContain('reason: cancelReason.trim()');
  });

  it('customer notification includes the reason when provided', () => {
    const src = read('src/app/api/admin/bookings/[id]/route.ts');
    expect(src).toMatch(/Reason: \$\{cancellationReason\}/);
  });
});
