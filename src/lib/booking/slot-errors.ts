/**
 * Shared Postgres error helpers for booking mutations.
 */

/** Detects a unique-index violation (23505) — e.g. double-booking a slot. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
