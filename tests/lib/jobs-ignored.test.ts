import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Tests for the scheduled job contract (src/lib/jobs):
 * - markNoShows has been REMOVED — the job must never create no_show.
 * - markIgnoredBookings moves untouched past 'confirmed' -> 'ignored'.
 * - Processing is idempotent (guarded on status='confirmed').
 * - The cron route wires 'ignoredMarked' instead of 'noShowsMarked'.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('scheduled job: ignored processing', () => {
  it('exports markIgnoredBookings and no longer exports markNoShows', () => {
    const jobs = read('src/lib/jobs/index.ts');
    expect(jobs).toContain('export async function markIgnoredBookings');
    expect(jobs).not.toContain('export async function markNoShows');
  });

  it('never writes no_show from the scheduled job module', () => {
    const jobs = read('src/lib/jobs/index.ts');
    expect(jobs).not.toContain("status: 'no_show'");
  });
});

describe('jobs route wiring', () => {
  const read = (p: string) => require('fs').readFileSync(require('path').join(process.cwd(), p), 'utf8');

  it('cron route schedules ignoredMarked and not noShowsMarked', () => {
    const route = read('src/app/api/jobs/route.ts');
    expect(route).toContain('markIgnoredBookings');
    expect(route).toContain("['ignoredMarked', markIgnoredBookings]");
    expect(route).not.toContain('markNoShows');
    expect(route).not.toContain('noShowsMarked');
  });

  it('cron route keeps CRON_SECRET protection', () => {
    const route = read('src/app/api/jobs/route.ts');
    expect(route).toContain('CRON_SECRET');
    expect(route).toContain('Bearer');
  });

  it('cron route documents that it never creates no_show', () => {
    const route = read('src/app/api/jobs/route.ts');
    expect(route).toContain('NEVER');
  });

  it('vercel.json keeps the daily job schedule', () => {
    const vercel = JSON.parse(read('vercel.json'));
    expect(vercel.crons).toHaveLength(1);
    expect(vercel.crons[0].path).toBe('/api/jobs');
    expect(vercel.crons[0].schedule).toBe('0 8 * * *');
  });
});

describe('ignored processing semantics (source contract)', () => {
  const read = (p: string) => require('fs').readFileSync(require('path').join(process.cwd(), p), 'utf8');

  it('only touches confirmed bookings (idempotent, never overwrites approved/no_show)', () => {
    const jobs = read('src/lib/jobs/index.ts');
    const fnStart = jobs.indexOf('export async function markIgnoredBookings');
    const fnBody = jobs.slice(fnStart, jobs.indexOf('}', jobs.indexOf("set({ status: 'ignored'")));
    expect(fnBody).toContain("eq(bookings.status, 'confirmed')");
    expect(fnBody).toContain("status: 'ignored'");
    expect(fnBody).not.toContain('no_show');
  });

  it('guards the bulk update on the confirmed status (race safety)', () => {
    const jobs = read('src/lib/jobs/index.ts');
    const fnStart = jobs.indexOf('export async function markIgnoredBookings');
    const fnBody = jobs.slice(fnStart, jobs.indexOf('export async function', fnStart + 10));
    expect(fnBody).toMatch(/inArray\(bookings\.id, toIgnore\)/);
  });
});
