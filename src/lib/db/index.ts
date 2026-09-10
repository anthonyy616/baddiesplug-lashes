import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';
import env from '@/lib/env';

const sql = postgres(env.databaseUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

const db = drizzle(sql, { schema });

export { db, sql };

export * from '@/lib/db/schema';
