import type { db as dbInstance } from '@/lib/db';

/**
 * Minimal structural type for a Drizzle transaction handle. Pass this into
 * helpers (queueEmailEvent, audit helpers, etc.) when they are called inside
 * a db.transaction() so writes commit and roll back together.
 */
export type TxLike = Parameters<Parameters<typeof dbInstance.transaction>[0]>[0];
