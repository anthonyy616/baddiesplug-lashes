import postgres from 'postgres';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';

/**
 * One-off: apply the Stage 6-10 migrations (0015-0017) to the current
 * DATABASE_URL and record them in drizzle.__drizzle_migrations. Safe to
 * re-run: every statement is idempotent (IF NOT EXISTS / DO $$ guards).
 */

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL missing');

const sql = postgres(url, { max: 1 });

async function main() {
  const migrations = [
    { tag: '0013_booking_source_admin_notes', file: 'db/migrations/0013_booking_source_admin_notes.sql' },
    { tag: '0014_favourite_services', file: 'db/migrations/0014_favourite_services.sql' },
    { tag: '0015_before_after_gallery', file: 'db/migrations/0015_before_after_gallery.sql' },
    { tag: '0016_availability_rules', file: 'db/migrations/0016_availability_rules.sql' },
    { tag: '0017_loyalty_codes', file: 'db/migrations/0017_loyalty_codes.sql' },
  ];

  for (const m of migrations) {
    const content = readFileSync(resolve(m.file), 'utf8');
    console.log(`applying ${m.tag} ...`);
    await sql.unsafe(content);
    console.log(`  ok`);
  }

  // Record applied migrations so a future `drizzle-kit migrate` on this DB
  // doesn't try to replay history. `created_at` mirrors the journal `when`.
  const journal = JSON.parse(
    readFileSync(resolve('db/migrations/meta/_journal.json'), 'utf8')
  ) as { entries: { tag: string; when: number }[] };

  for (const m of migrations) {
    const entry = journal.entries.find((e) => e.tag === m.tag);
    const hash = Buffer.from(m.tag).toString('hex');
    await sql`
      insert into drizzle.__drizzle_migrations (hash, created_at)
      select ${hash}, ${entry ? entry.when : Date.now()}
      where not exists (
        select 1 from drizzle.__drizzle_migrations where hash = ${hash}
      )`;
  }

  const applied = await sql`
    select count(*)::int as n from drizzle.__drizzle_migrations`;
  console.log('drizzle migration rows now:', applied[0].n);

  // Sanity: verify the new objects exist.
  for (const t of [
    'before_after_gallery',
    'availability_rules',
    'loyalty_codes',
    'loyalty_code_redemptions',
  ]) {
    const [row] = await sql`
      select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = ${t}
      ) as ok`;
    console.log(`${t}: ${row.ok ? 'EXISTS' : 'MISSING'}`);
  }

  const rulesCols = await sql`
    select column_name from information_schema.columns
    where table_name = 'availability_rules' order by ordinal_position`;
  console.log(
    'availability_rules cols:',
    rulesCols.map((c) => c.column_name).join(', ')
  );

  const bcols = await sql`
    select column_name from information_schema.columns
    where table_name = 'bookings' and column_name like 'discount%'`;
  console.log('bookings discount cols:', bcols.map((c) => c.column_name).join(', '));
}

main()
  .then(() => sql.end())
  .catch((e) => {
    console.error(e);
    return sql.end().then(() => process.exit(1));
  });
