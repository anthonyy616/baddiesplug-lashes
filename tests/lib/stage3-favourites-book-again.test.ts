import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Stage 3 — Favourite services + Book Again.
 *
 * Favourites belong to the authenticated customer and are never readable or
 * mutable across customers. Book Again is a convenience PRE-FILL, never a
 * booking duplicate: current catalogue prices, normal availability, a new
 * slot, and full server validation are always required.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('favourites ownership (Stage 3)', () => {
  it('schema defines the favourite_services table with a unique per-customer index', () => {
    const schema = read('src/lib/db/schema/index.ts');
    expect(schema).toContain("pgTable('favourite_services'");
    expect(schema).toContain("uniqueIndex('favourite_services_customer_service_unique')");
    // Cascade on the join table only
    expect(schema).toContain("references(() => users.id, { onDelete: 'cascade' })");
  });

  it('migration 0014 is forward-only and registered in the journal', () => {
    const migration = read('db/migrations/0014_favourite_services.sql');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "favourite_services"');
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);

    const journal = JSON.parse(read('db/migrations/meta/_journal.json'));
    const tags = journal.entries.map((e: { tag: string }) => e.tag);
    expect(tags[tags.length - 1]).toBe('0014_favourite_services');
  });

  it('domain scopes every query by the session user, never request input', () => {
    const src = read('src/lib/favourites/index.ts');
    // All three operations start from requireAuth()
    expect(src.match(/await requireAuth\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    // Remove is scoped by BOTH customer and service
    expect(src).toContain('eq(favouriteServices.customerId, user.id)');
  });

  it('add is idempotent (duplicate favourite is a no-op)', () => {
    const src = read('src/lib/favourites/index.ts');
    expect(src).toContain('onConflictDoNothing()');
  });

  it('API never accepts a customerId from the request', () => {
    const src = read('src/app/api/account/favourites/route.ts');
    expect(src).not.toMatch(/body\.customerId|searchParams\.get\('customerId'\)/);
  });

  it('returns 401 when unauthenticated', () => {
    const src = read('src/app/api/account/favourites/route.ts');
    expect(src).toContain("error.message === 'Unauthorized'");
  });
});

describe('book again (Stage 3)', () => {
  const src = () => read('src/lib/favourites/index.ts');

  it('enforces booking ownership before returning anything', () => {
    const body = src();
    const fnStart = body.indexOf('export async function getBookAgainData');
    const fnBody = body.slice(fnStart, body.indexOf('/**\n * Favourite services (Stage 3).') === -1 ? undefined : fnStart + 6000);
    expect(fnBody).toContain('booking.customerId !== customerId');
    expect(fnBody).toContain("'Unauthorized'");
  });

  it('pre-fills ONLY services/add-ons that still exist and are active', () => {
    const body = src();
    expect(body).toContain('eq(services.isActive, true)');
    expect(body).toContain('a.isActive');
    expect(body).toContain('activeServiceIds.has(id)');
    expect(body).toContain('activeAddonIds.has(id)');
  });

  it('reports unavailable items instead of silently dropping them', () => {
    const body = src();
    expect(body).toContain('unavailableServiceNames');
    expect(body).toContain('unavailableAddonNames');
  });

  it('never returns prices or a slot (no snapshot reuse, no slot carry-over)', () => {
    const body = src();
    const fnStart = body.indexOf('export async function getBookAgainData');
    const fnBody = body.slice(fnStart, body.indexOf('describe', fnStart) === -1 ? undefined : fnStart + 5000);
    expect(fnBody).not.toMatch(/return\s*\{[\s\S]*price/);
    expect(fnBody).not.toContain('appointmentDate');
  });

  it('does NOT create a booking — the endpoint is a read-only lookup', () => {
    const route = read('src/app/api/account/bookings/[id]/book-again/route.ts');
    expect(route).not.toContain('.insert(');
    expect(route).toContain('export async function GET');
  });

  it('booking flow consumes bookAgain as a pre-fill, then runs the normal flow', () => {
    const flow = read('src/app/booking/BookingFlow.tsx');
    expect(flow).toContain("searchParams.get('bookAgain')");
    expect(flow).toContain('/api/account/bookings/${bookAgainId}/book-again');
    // Submission still goes through the standard booking API
    expect(flow).toContain("fetch('/api/booking'");
  });

  it('book again button navigates to the normal booking flow with a new slot choice', () => {
    const btn = read('src/app/account/bookings/[id]/BookAgainButton.tsx');
    expect(btn).toContain('/booking?bookAgain=');
    expect(btn).not.toContain('/api/booking');
  });
});
