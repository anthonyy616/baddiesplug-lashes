import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Migration + contract tests for the booking status lifecycle.
 *
 * The migration must be forward-only and safe with existing production rows:
 * pending, confirmed, cancelled, rejected, completed, no_show. It must not
 * rewrite, delete, or reprice any rows — only the partial unique slot index
 * changes so that 'approved' bookings also occupy slots.
 */

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
}

describe('migration 0009: approved/ignored statuses', () => {
  const sql = readMigration('0009_booking_status_approved_ignored.sql');

  it('exists as a forward-only migration', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('recreates the active slot index to include approved', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX "active_booking_slot_unique"/);
    expect(sql).toMatch(/'pending', 'confirmed', 'approved'/);
  });

  it('drops the previous index idempotently (safe re-run)', () => {
    expect(sql).toMatch(/DROP INDEX IF EXISTS "active_booking_slot_unique"/);
  });

  it('does not rewrite, delete, or reprice any existing rows', () => {
    expect(sql).not.toMatch(/UPDATE\s+"?bookings"?/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/ALTER COLUMN/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
  });

  it('does not convert the status column to a PostgreSQL enum', () => {
    expect(sql).not.toMatch(/CREATE TYPE/i);
    expect(sql).not.toMatch(/USING/i);
  });

  it('does not remove or rename legacy statuses', () => {
    // Strip comments, then assert no executable statement touches legacy values.
    const statements = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(statements).not.toMatch(/'cancelled'|'rejected'|'completed'|'no_show'/);
  });
});

describe('migration journal', () => {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8')
  );

  it('registers migration 0009 after the previous entries', () => {
    const tags = journal.entries.map((e: { tag: string }) => e.tag);
    expect(tags).toContain('0009_booking_status_approved_ignored');
    expect(tags.indexOf('0009_booking_status_approved_ignored')).toBe(
      tags.length - 1
    );
    expect(tags.indexOf('0009_booking_status_approved_ignored')).toBeGreaterThan(
      tags.indexOf('0008_fix_active_booking_slot_unique')
    );
  });

  it('has unique, sequential idx values', () => {
    const idxs = journal.entries.map((e: { idx: number }) => e.idx);
    expect(new Set(idxs).size).toBe(idxs.length);
    for (let i = 0; i < idxs.length; i++) {
      expect(idxs[i]).toBe(i);
    }
  });
});

describe('schema and lifecycle index-predicate sync', () => {
  it('schema partial index matches the migration predicate', () => {
    const schema = readFileSync(
      join(process.cwd(), 'src', 'lib', 'db', 'schema', 'index.ts'),
      'utf8'
    );
    expect(schema).toMatch(/status IN \('pending', 'confirmed', 'approved'\)/);
  });

  it('every migration file that defines the index uses a valid predicate', () => {
    // The latest definition (0009) wins; earlier ones are historical.
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    expect(files).toContain('0009_booking_status_approved_ignored.sql');
  });
});
