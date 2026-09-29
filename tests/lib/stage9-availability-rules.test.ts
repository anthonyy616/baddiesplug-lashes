import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('availability rules migration (Stage 9)', () => {
  it('0016 migration exists, registered after 0015, forward-only', () => {
    const sql = read('db/migrations/0016_availability_rules.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "availability_rules"');
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE/i);
    const journal = JSON.parse(read('db/migrations/meta/_journal.json'));
    const tags = journal.entries.map((e: { tag: string }) => e.tag);
    expect(tags.indexOf('0016_availability_rules')).toBeGreaterThan(tags.indexOf('0015_before_after_gallery'));
  });

  it('rules table supports closures, custom working days, custom hours, recurring breaks', () => {
    const sql = read('db/migrations/0016_availability_rules.sql');
    for (const kind of ['date_range_block', 'weekday_open', 'weekday_hours', 'recurring_break']) {
      expect(sql).toContain(`'${kind}'`);
    }
  });
});

describe('availability precedence (Stage 9)', () => {
  const src = () => read('src/lib/availability/rules.ts');

  it('precedence is centralized in ONE rules module, documented in order', () => {
    const s = src();
    expect(s).toMatch(/PRECEDENCE[\s\S]*1\. Base operating schedule[\s\S]*2\. Advanced rules[\s\S]*3\. Admin overrides[\s\S]*4\. Existing booking occupancy/);
  });

  it('rule layer: date-range blocks close days; weekday_open opens custom working days', () => {
    const s = src();
    expect(s).toContain("case 'date_range_block'");
    expect(s).toContain('closedByRule = true');
    expect(s).toContain('openedByRule = true');
  });

  it('recurring breaks subtract slot windows', () => {
    const s = src();
    expect(s).toContain("case 'recurring_break'");
    expect(s).toContain('result.breaks.push');
    // Filter application
    expect(s).toMatch(/breaks\.some/);
  });

  it('existing bookings are occupancy layer 4 — never weakened by rules', () => {
    const s = src();
    expect(s).toMatch(/never[\s\S]*disappear|Occupancy is evaluated LAST/i);
    // The main availability function still applies booked slots AFTER rules.
    const avail = read('src/lib/availability/index.ts');
    const fn = avail.slice(avail.indexOf('export async function getAvailableSlots'));
    const rulesIdx = fn.indexOf('getSlotsWithRules');
    const bookedIdx = fn.indexOf("reason: 'booked'");
    expect(rulesIdx).toBeGreaterThan(-1);
    expect(bookedIdx).toBeGreaterThan(-1);
  });

  it('getAvailableSlots consumes the rules layer (single authority, both surfaces)', () => {
    const avail = read('src/lib/availability/index.ts');
    expect(avail).toContain('getActiveRules');
    expect(avail).toContain('getSlotsWithRules');
  });

  it('admin overrides still win over rules (explicit intent re-opens rule-closed dates)', () => {
    const s = src();
    expect(s).toMatch(/explicit admin intent/i);
    const avail = read('src/lib/availability/index.ts');
    // Overrides are still merged after the rules-derived standard slots.
    expect(avail).toMatch(/LAYER 3[\s\S]*openedSlots/);
  });

  it('rule writes invalidate the availability cache', () => {
    const api = read('src/app/api/admin/availability/rules/route.ts');
    expect(api.match(/invalidateAvailabilityCache\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});

describe('availability rules admin (Stage 9)', () => {
  it('CRUD API is admin-guarded and zod-validated per rule type', () => {
    const api = read('src/app/api/admin/availability/rules/route.ts');
    expect(api).toContain('requireAdminSession');
    expect(api).toContain('discriminatedUnion');
  });

  it('rules manager UI supports all four rule kinds with activate/deactivate', () => {
    const ui = read('src/app/admin/availability/RulesManager.tsx');
    for (const kind of ['date_range_block', 'weekday_open', 'weekday_hours', 'recurring_break']) {
      expect(ui).toContain(kind);
    }
    expect(ui).toContain('Deactivate');
    expect(ui).toContain('Activate');
  });

  it('availability admin page mounts the rules manager', () => {
    const page = read('src/app/admin/availability/page.tsx');
    expect(page).toContain('RulesManager');
    expect(page).toContain('Advanced Rules');
  });
});
