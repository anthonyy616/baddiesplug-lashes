import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'fs';

/**
 * Apply db/migrations/0010_audit_events_booking_idempotency.sql directly.
 * This project applies forward-only migrations manually (the drizzle
 * migrations table is unused), so we run the SQL file the same way
 * db/run-sql.ts does. The file is idempotent (IF NOT EXISTS guards).
 */

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function main() {
  const script = readFileSync(
    'db/migrations/0011_email_events_updated_at.sql',
    'utf8'
  );
  await sql.unsafe(script);
  console.log('✓ Applied 0011_email_events_updated_at.sql');

  // Verify
  const col = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'email_events' AND column_name = 'updated_at'`;
  const idx = await sql`
    SELECT indexname FROM pg_indexes
    WHERE indexname = 'email_events_status_updated_at_idx'`;

  console.log('email_events.updated_at column:', col.length > 0 ? 'EXISTS' : 'MISSING');
  console.log('status+updated_at index:', idx.length > 0 ? 'EXISTS' : 'MISSING');

  if (col.length === 0) {
    throw new Error('Verification failed — migration did not fully apply');
  }
  console.log('✓ Verified: all 0011 objects present');
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error('✗ Failed:', err.message);
    await sql.end();
    process.exit(1);
  });
