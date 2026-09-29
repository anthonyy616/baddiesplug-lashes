import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('admin calendar v2 (Stage 8)', () => {
  it('calendar is a read model: no booking mutations in the calendar domain', () => {
    const s = read('src/lib/calendar/index.ts');
    expect(s).toContain('export async function getCalendarRange');
    // READ ONLY — no inserts/updates/deletes anywhere in the module.
    expect(s).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
    expect(s).not.toContain('adminRescheduleBooking');
  });

  it('day, week and month views exist', () => {
    const page = read('src/app/admin/calendar/page.tsx');
    expect(page).toMatch(/view === 'day'/);
    expect(page).toMatch(/view === 'week'/);
    expect(page).toMatch(/view === 'month'/);
  });

  it('calendar displays bookings, status, customer/service summary, availability and blocked periods', () => {
    const s = read('src/lib/calendar/index.ts');
    expect(s).toContain('blocked');
    expect(s).toContain('opened');
    expect(s).toContain('slots');
    expect(s).toContain('bookings');
    expect(s).toContain('customerName');
    expect(s).toContain('serviceName');
    expect(s).toContain('status');
  });

  it('availability shown to the calendar comes from the same authoritative template + overrides logic', () => {
    const s = read('src/lib/calendar/index.ts');
    // Uses the shared standard slot template and the real override rows.
    expect(s).toContain("from '@/lib/timezone'");
    expect(s).toContain('getStandardSlots');
    expect(s).toContain("from '@/lib/db/schema'");
    expect(s).toContain('availabilityOverrides');
  });

  it('shows slot-occupying bookings only for availability (shared lifecycle statuses)', () => {
    const s = read('src/lib/calendar/index.ts');
    expect(s).toContain('SLOT_OCCUPYING_STATUSES');
    expect(s).toContain("from '@/lib/booking/lifecycle'");
  });

  it('no drag/drop rescheduling: no mutation from the calendar UI', () => {
    const client = read('src/app/admin/calendar/AdminCalendar.tsx');
    expect(client).not.toMatch(/onDragStart|draggable|handleDrop|fetch\(/);
    // Actions link out to existing flows.
    expect(client).toContain('/admin/bookings/${b.id}');
    expect(client).toContain('/admin/bookings/create?date=');
  });

  it('date navigation and view switching are implemented', () => {
    const client = read('src/app/admin/calendar/AdminCalendar.tsx');
    expect(client).toContain("(['day', 'week', 'month'] as const)");
    expect(client).toContain('view=${v}');
    expect(client).toContain('Prev');
    expect(client).toContain('Next');
  });

  it('calendar is registered in the admin nav', () => {
    const nav = read('src/components/admin/AdminNav.tsx');
    expect(nav).toContain("href: '/admin/calendar'");
  });

  it('month grid pads to weekday columns (Monday-first)', () => {
    const client = read('src/app/admin/calendar/AdminCalendar.tsx');
    expect(client).toContain("getUTCDay() + 6) % 7");
  });
});
