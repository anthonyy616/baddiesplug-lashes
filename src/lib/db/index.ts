import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@/lib/db/schema';
import env from '@/lib/env';

const sql = neon(env.databaseUrl);

export const db = drizzle(sql, { schema });
export { sql };

export * from '@/lib/db/schema';
