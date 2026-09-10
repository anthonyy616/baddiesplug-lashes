import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';
import env from '@/lib/env';

const sql = postgres(env.databaseUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  // statement_timeout is accepted at runtime by the postgres client;
  // it's not exposed in the TS Options type, so we assert via unknown.
  // Parameters<typeof postgres>[1] is the options arg.
  statement_timeout: 10_000, // 10s — prevent a single query from hanging a transaction for minutes
} as unknown as Parameters<typeof postgres>[1]);

const db = drizzle(sql, { schema });

export { db, sql };

export * from '@/lib/db/schema';
