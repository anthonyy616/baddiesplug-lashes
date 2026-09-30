import postgres from 'postgres';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';

/**
 * Cross-check the live database against the Drizzle schema: every column
 * declared in src/lib/db/schema/index.ts must exist (by DB column name) on
 * its table in the current DATABASE_URL.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  const schemaSrc = readFileSync(
    resolve('src/lib/db/schema/index.ts'),
    'utf8'
  );

  // Parse pgTable blocks: table('name', { prop: type('db_col', ...) })
  const tableBlocks = [
    ...schemaSrc.matchAll(/export const (\w+) = pgTable\('([^']+)', \{([\s\S]*?)\n\},?\s*\(/g),
  ];

  const expected = new Map<string, Set<string>>();
  for (const [, , tableName, body] of tableBlocks) {
    const cols = new Set<string>();
    for (const m of body.matchAll(/:\s*(?:varchar|text|integer|boolean|uuid|timestamp|date)\('([^']+)'/g)) {
      cols.add(m[1]);
    }
    expected.set(tableName, cols);
  }

  let problems = 0;
  for (const [table, cols] of expected) {
    const [exists] = await sql`
      select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = ${table}
      ) as ok`;
    if (!exists.ok) {
      console.log(`MISSING TABLE: ${table}`);
      problems++;
      continue;
    }
    const live = await sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = ${table}`;
    const liveCols = new Set(live.map((c) => c.column_name));
    for (const col of cols) {
      if (!liveCols.has(col)) {
        console.log(`MISSING COLUMN: ${table}.${col}`);
        problems++;
      }
    }
  }

  if (problems === 0) {
    console.log('SCHEMA OK: every Drizzle column exists in the database');
  } else {
    console.log(`${problems} problem(s) found`);
    process.exitCode = 1;
  }
}

main()
  .then(() => sql.end())
  .catch((e) => {
    console.error(e);
    return sql.end().then(() => process.exit(1));
  });
