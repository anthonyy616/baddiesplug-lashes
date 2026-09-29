import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Stage 2 — Admin custom booking creation.
 *
 * Admin-created bookings must run through the SAME server-authoritative rules
 * as website bookings: recalculated pricing, snapshots, availability/slot
 * collision protection, Lagos timezone, references, booking events, durable
 * email. A booking-source concept distinguishes 'customer' vs 'admin'.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('booking source concept (Stage 2)', () => {
  it('schema defines a booking_source column defaulting to customer', () => {
    const schema = read('src/lib/db/schema/index.ts');
    expect(schema).toContain("bookingSource: varchar('booking_source'");
    expect(schema).toContain(".notNull().default('customer')");
  });

  it('migration 0013 adds the column safely and non-destructively', () => {
    const migration = read('db/migrations/0013_booking_source_admin_notes.sql');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "booking_source"');
    expect(migration).toContain("DEFAULT 'customer'");
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "admin_booking_notes"');
    // Forward-only: no destructive operations
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).not.toMatch(/UPDATE\s+"?bookings"?/i);
  });

  it('migration 0013 is registered in the journal after 0012', () => {
    const journal = JSON.parse(read('db/migrations/meta/_journal.json'));
    const tags = journal.entries.map((e: { tag: string }) => e.tag);
    expect(tags).toContain('0013_booking_source_admin_notes');
    expect(tags.indexOf('0013_booking_source_admin_notes')).toBe(tags.length - 1);
    const idxs = journal.entries.map((e: { idx: number }) => e.idx);
    expect(new Set(idxs).size).toBe(idxs.length);
  });
});

describe('admin creation domain service (Stage 2)', () => {
  const src = () => read('src/lib/booking/admin-create.ts');

  it('requires admin authorization', () => {
    expect(src()).toContain('await requireAdmin()');
  });

  it('requires an existing customer row (no orphan bookings)', () => {
    const body = src();
    expect(body).toContain('users.id, customerId');
    expect(body).toContain("Customer not found");
  });

  it('recalculates pricing server-side from the catalogue (never trusts UI)', () => {
    const body = src();
    expect(body).toContain('calculateBookingTotal(input.serviceIds');
    // Verifies requested services/addons actually resolve (no silent drift)
    expect(body).toContain('priceSnapshot.services.length !== new Set(input.serviceIds).size');
    expect(body).toContain('One or more selected services are unavailable');
  });

  it('validates the slot through the admin slot validator (availability + collision protection)', () => {
    const body = src();
    expect(body).toContain('validateAdminSlot(input.date, input.startTime, input.endTime)');
    expect(body).toContain("slotValidation.valid");
  });

  it('inserts with bookingSource admin and stores admin notes', () => {
    const body = src();
    expect(body).toContain("bookingSource: 'admin'");
    expect(body).toContain('adminBookingNotes: input.adminNotes || null');
  });

  it('records service and add-on snapshots', () => {
    const body = src();
    expect(body).toContain('serviceNameSnapshot: s.name');
    expect(body).toContain('unitPriceSnapshot: s.price');
    expect(body).toContain('addonNameSnapshot: a.name');
  });

  it('records an immutable audit event marking administrative creation', () => {
    const body = src();
    expect(body).toContain("eventType: 'created'");
    expect(body).toContain("actorType: 'admin'");
    expect(body).toContain("bookingSource: 'admin'");
  });

  it('queues a durable customer email inside the transaction (dispatch after commit)', () => {
    const body = src();
    expect(body).toContain("eventType: 'booking.confirmed'");
    const queueIdx = body.indexOf("eventType: 'booking.confirmed'");
    const txEnd = body.indexOf('// Best-effort async dispatch');
    expect(queueIdx).toBeGreaterThan(body.indexOf('await db.transaction'));
    expect(queueIdx).toBeLessThan(txEnd);
    expect(body).toContain('getDispatchableEventIds(bookingId)');
    expect(body).toContain('dispatchEmailEvent(eventId)');
  });

  it('invalidates the availability cache for the booked date after commit', () => {
    const body = src();
    expect(body).toContain('invalidateAvailabilityCache(input.date)');
  });

  it('maps unique-index violations to slot-not-available (double-booking protection)', () => {
    const body = src();
    expect(body).toContain('isUniqueViolation(error)');
    expect(body).toContain("error: 'slot_not_available'");
  });
});

describe('admin create API route (Stage 2)', () => {
  const src = () => read('src/app/api/admin/bookings/create/route.ts');

  it('validates the payload with zod (uuid services, HH:MM times, YYYY-MM-DD date)', () => {
    const body = src();
    expect(body).toContain('customerId: z.string().uuid()');
    expect(body).toContain('serviceIds: z.array(z.string().uuid()).min(1)');
    expect(body).toContain("startTime: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/)");
    expect(body).toContain("date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/)");
  });

  it('provides a customer search endpoint scoped to customer accounts', () => {
    const body = src();
    expect(body).toContain("eq(users.role, 'customer')");
    expect(body).toContain('ilike(users.name');
    expect(body).toContain('ilike(users.email');
    expect(body).toContain('ilike(users.phone');
  });

  it('maps slot conflicts to 409 and enforces authorization', () => {
    const body = src();
    expect(body).toContain('status: 409');
    expect(body).toContain("'Forbidden'");
  });
});

describe('admin UI wiring (Stage 2)', () => {
  it('exposes a Create Booking page reusing the server catalogue', () => {
    const page = read('src/app/admin/bookings/create/page.tsx');
    expect(page).toContain('getActiveServices');
    expect(page).toContain('getActiveAddons');
    expect(page).toContain('AdminCreateBookingForm');
  });

  it('form does not send prices to the server (server recalculates)', () => {
    const form = read('src/components/admin/AdminCreateBookingForm.tsx');
    const bodyMatch = form.match(/JSON\.stringify\(\{[\s\S]*?\}\)/);
    expect(bodyMatch).not.toBeNull();
    expect(bodyMatch![0]).not.toMatch(/\bprice\b|subtotal|total/);
  });

  it('form blocks submission until a customer, services, slot, and phone are set', () => {
    const form = read('src/components/admin/AdminCreateBookingForm.tsx');
    expect(form).toContain('selectedServiceIds.length > 0');
    expect(form).toContain('Boolean(slot)');
    expect(form).toContain('phone.trim().length >= 10');
  });

  it('admin nav and bookings list link to the create page', () => {
    expect(read('src/components/admin/AdminNav.tsx')).toContain("'/admin/bookings/create'");
    expect(read('src/app/admin/bookings/page.tsx')).toContain('href="/admin/bookings/create"');
  });
});
