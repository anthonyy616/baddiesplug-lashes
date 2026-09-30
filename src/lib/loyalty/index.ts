import 'server-only';
import { db } from '@/lib/db';
import {
  loyaltyCodes,
  loyaltyCodeRedemptions,
  services,
  bookings,
} from '@/lib/db/schema';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { TxLike } from '@/lib/db/tx';

/**
 * Loyalty + promotional codes (Stage 10).
 *
 * ONE unified retention/discount system:
 *  - 'loyalty' codes are assigned to ONE customer and usable only by them.
 *  - 'promo' codes are general and usable by any authenticated customer.
 *
 * ALL validation and discount computation happens SERVER-SIDE. The client
 * supplies only the code string; the discount amount, final total, and
 * redemption record are computed and snapshotted here inside the booking
 * transaction. Catalogue totals (subtotal/total) stay untouched; the discount
 * lives in the booking snapshot columns (discount_code / discount_amount /
 * final_total) so later code changes never rewrite history.
 *
 * Order of operations (matches the plan):
 *   catalogue subtotal -> eligible discount -> final booking total ->
 *   deposit rules (deposit = max(50% of FINAL total, 500000 kobo)).
 */

export type LoyaltyCodeType = 'loyalty' | 'promo';

export interface LoyaltyCodeRecord {
  id: string;
  code: string;
  codeType: LoyaltyCodeType;
  customerId: string | null;
  discountPercent: number;
  applicableServiceIds: string[] | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  revokedAt: Date | null;
  note: string | null;
  createdAt: Date;
}

const CODE_RE = /^[A-Z0-9]{4,40}$/;

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidCodeFormat(raw: string): boolean {
  return CODE_RE.test(normalizeCode(raw));
}

function parseApplicable(raw: string | null): string[] | null {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const ids = parsed.filter((x): x is string => typeof x === 'string');
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

function toRecord(row: typeof loyaltyCodes.$inferSelect): LoyaltyCodeRecord {
  return {
    id: row.id,
    code: row.code,
    codeType: row.codeType as LoyaltyCodeType,
    customerId: row.customerId ?? null,
    discountPercent: row.discountPercent,
    applicableServiceIds: parseApplicable(row.applicableServiceIds ?? null),
    startsAt: row.startsAt ?? null,
    expiresAt: row.expiresAt ?? null,
    usageLimit: row.usageLimit ?? null,
    usageCount: row.usageCount,
    isActive: row.isActive,
    revokedAt: row.revokedAt ?? null,
    note: row.note ?? null,
    createdAt: row.createdAt,
  };
}

/* ------------------------------------------------------------------ */
/* Admin CRUD                                                          */
/* ------------------------------------------------------------------ */

export interface CreateLoyaltyCodeInput {
  code: string;
  codeType: LoyaltyCodeType;
  customerId: string | null;
  discountPercent: number;
  applicableServiceIds?: string[] | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  usageLimit?: number | null;
  note?: string | null;
  createdByAdminId?: string | null;
}

/** Admin creates a loyalty (customer-specific) or promo (general) code. */
export async function createLoyaltyCode(
  input: CreateLoyaltyCodeInput
): Promise<{ ok: true; record: LoyaltyCodeRecord } | { ok: false; error: string }> {
  const code = normalizeCode(input.code);
  if (!CODE_RE.test(code)) {
    return { ok: false, error: 'Code must be 4-40 uppercase letters/digits.' };
  }
  if (input.codeType === 'loyalty' && !input.customerId) {
    return { ok: false, error: 'Loyalty codes must be assigned to a customer.' };
  }
  if (
    !Number.isInteger(input.discountPercent) ||
    input.discountPercent < 1 ||
    input.discountPercent > 100
  ) {
    return { ok: false, error: 'Discount percent must be an integer between 1 and 100.' };
  }
  if (input.usageLimit !== undefined && input.usageLimit !== null) {
    if (!Number.isInteger(input.usageLimit) || input.usageLimit < 1) {
      return { ok: false, error: 'Usage limit must be a positive integer or null (unlimited).' };
    }
  }
  if (input.startsAt && input.expiresAt && input.startsAt > input.expiresAt) {
    return { ok: false, error: 'startsAt must be before expiresAt.' };
  }
  if (input.applicableServiceIds && input.applicableServiceIds.length > 0) {
    const found = await db
      .select({ id: services.id })
      .from(services)
      .where(inArray(services.id, input.applicableServiceIds));
    if (found.length !== new Set(input.applicableServiceIds).size) {
      return { ok: false, error: 'One or more applicable services do not exist.' };
    }
  }

  try {
    const [row] = await db
      .insert(loyaltyCodes)
      .values({
        code,
        codeType: input.codeType,
        customerId: input.codeType === 'loyalty' ? input.customerId : null,
        discountPercent: input.discountPercent,
        applicableServiceIds:
          input.applicableServiceIds && input.applicableServiceIds.length > 0
            ? JSON.stringify(input.applicableServiceIds)
            : null,
        startsAt: input.startsAt ?? null,
        expiresAt: input.expiresAt ?? null,
        usageLimit: input.usageLimit ?? null,
        note: input.note?.slice(0, 255) ?? null,
        createdByAdminId: input.createdByAdminId ?? null,
      })
      .returning();
    return { ok: true, record: toRecord(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'A code with this string already exists.' };
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

/** Admin list — every code with redemptions count available for inspection. */
export async function listLoyaltyCodes(): Promise<
  (LoyaltyCodeRecord & { redemptions: number })[]
> {
  const rows = await db
    .select()
    .from(loyaltyCodes)
    .orderBy(desc(loyaltyCodes.createdAt), asc(loyaltyCodes.code));

  const redemptionRows = await db
    .select({ codeId: loyaltyCodeRedemptions.codeId, count: sql<number>`count(*)` })
    .from(loyaltyCodeRedemptions)
    .groupBy(loyaltyCodeRedemptions.codeId);
  const counts = new Map(redemptionRows.map((r) => [r.codeId, Number(r.count || 0)]));

  return rows.map((row) => ({ ...toRecord(row), redemptions: counts.get(row.id) ?? 0 }));
}

/** Codes assigned to (or usable by) one customer — read-only Rewards view. */
export async function getCustomerCodes(customerId: string): Promise<LoyaltyCodeRecord[]> {
  const rows = await db
    .select()
    .from(loyaltyCodes)
    .where(
      or(
        eq(loyaltyCodes.customerId, customerId),
        eq(loyaltyCodes.codeType, 'promo')
      )
    )
    .orderBy(desc(loyaltyCodes.createdAt));
  return rows.map(toRecord);
}

/**
 * Whether the customer has AT LEAST ONE currently usable code. Drives UI
 * gating: the booking-flow promo field renders only when this is true, so a
 * code that is deactivated, revoked, expired, or exhausted makes the field
 * disappear entirely. (Applicability to the current cart is checked at
 * apply-time — this gate is only about code existence/health.)
 */
export async function hasUsableCodesForCustomer(customerId: string): Promise<boolean> {
  const codes = await getCustomerCodes(customerId);
  const now = new Date();
  return codes.some(
    (c) =>
      c.isActive &&
      !c.revokedAt &&
      (!c.startsAt || now >= c.startsAt) &&
      (!c.expiresAt || now <= c.expiresAt) &&
      (c.usageLimit === null || c.usageCount < c.usageLimit)
  );
}

export async function setLoyaltyCodeActive(id: string, isActive: boolean): Promise<boolean> {
  const updated = await db
    .update(loyaltyCodes)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(loyaltyCodes.id, id))
    .returning({ id: loyaltyCodes.id });
  return updated.length > 0;
}

export async function revokeLoyaltyCode(id: string): Promise<boolean> {
  const updated = await db
    .update(loyaltyCodes)
    .set({ isActive: false, revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(loyaltyCodes.id, id))
    .returning({ id: loyaltyCodes.id });
  return updated.length > 0;
}

/** Per-use inspection for the admin manager. */
export async function getLoyaltyCodeRedemptions(codeId: string) {
  return db
    .select({
      id: loyaltyCodeRedemptions.id,
      bookingId: loyaltyCodeRedemptions.bookingId,
      discountAmount: loyaltyCodeRedemptions.discountAmount,
      redeemedAt: loyaltyCodeRedemptions.redeemedAt,
    })
    .from(loyaltyCodeRedemptions)
    .where(eq(loyaltyCodeRedemptions.codeId, codeId))
    .orderBy(desc(loyaltyCodeRedemptions.redeemedAt));
}

/* ------------------------------------------------------------------ */
/* Server-side validation + redemption                                 */
/* ------------------------------------------------------------------ */

export interface CodeValidationInput {
  code: string;
  customerId: string;
  serviceIds: string[];
  subtotal: number; // kobo, from calculateBookingTotal — never client-supplied
}

export type CodeValidationFailure =
  | 'invalid_code'
  | 'not_found'
  | 'ownership'
  | 'inactive'
  | 'revoked'
  | 'not_started'
  | 'expired'
  | 'usage_limit'
  | 'service_mismatch'
  | 'zero_subtotal';

export type CodeValidationResult =
  | {
      ok: true;
      codeId: string;
      code: string;
      discountPercent: number;
      discountAmount: number;
      finalTotal: number;
    }
  | { ok: false; error: CodeValidationFailure };

/**
 * Validate a code against the authenticated customer, their cart, and the
 * catalogue subtotal — and compute the discount. PURE validation: nothing is
 * written. Redemption is recorded by `recordRedemption` inside the booking
 * transaction so validation and redemption can never drift apart.
 */
export async function validateAndApplyCode(
  input: CodeValidationInput
): Promise<CodeValidationResult> {
  const code = normalizeCode(input.code);
  if (!CODE_RE.test(code)) return { ok: false, error: 'invalid_code' };
  if (!(input.subtotal > 0)) return { ok: false, error: 'zero_subtotal' };

  const [row] = await db
    .select()
    .from(loyaltyCodes)
    .where(eq(loyaltyCodes.code, code));

  return validateGuardChain(code, row ?? null, input);
}

/**
 * Core guard chain (shared by any surface that previews or redeems a code).
 * `row === null` means the code string matched nothing.
 */
function validateGuardChain(
  code: string,
  row: typeof loyaltyCodes.$inferSelect | null,
  input: CodeValidationInput
): CodeValidationResult {
  if (!CODE_RE.test(code)) return { ok: false, error: 'invalid_code' };
  if (!(input.subtotal > 0)) return { ok: false, error: 'zero_subtotal' };
  if (!row) return { ok: false, error: 'not_found' };

  const record = toRecord(row);

  // Ownership: loyalty codes are usable ONLY by their assigned customer.
  if (record.codeType === 'loyalty' && record.customerId !== input.customerId) {
    return { ok: false, error: 'ownership' };
  }

  if (!record.isActive) return { ok: false, error: 'inactive' };
  if (record.revokedAt) return { ok: false, error: 'revoked' };

  const now = new Date();
  if (record.startsAt && now < record.startsAt) return { ok: false, error: 'not_started' };
  if (record.expiresAt && now > record.expiresAt) return { ok: false, error: 'expired' };
  if (record.usageLimit !== null && record.usageCount >= record.usageLimit) {
    return { ok: false, error: 'usage_limit' };
  }

  // Applicability: null = all active services; otherwise the cart must
  // contain at least one applicable service.
  if (
    record.applicableServiceIds !== null &&
    !input.serviceIds.some((id) => record.applicableServiceIds!.includes(id))
  ) {
    return { ok: false, error: 'service_mismatch' };
  }

  const discountAmount = Math.min(
    Math.round((input.subtotal * record.discountPercent) / 100),
    input.subtotal
  );
  const finalTotal = input.subtotal - discountAmount;

  return {
    ok: true,
    codeId: record.id,
    code: record.code,
    discountPercent: record.discountPercent,
    discountAmount,
    finalTotal,
  };
}

/**
 * Record a redemption + increment usageCount INSIDE the booking transaction.
 * The guard re-checks the usage limit on the UPDATE (usage_count < limit) so
 * two concurrent bookings cannot both consume the last allowed use.
 */
export async function recordRedemption(
  input: { codeId: string; bookingId: string; customerId: string; discountAmount: number },
  tx: TxLike
): Promise<void> {
  const updated = await tx
    .update(loyaltyCodes)
    .set({ usageCount: sql`${loyaltyCodes.usageCount} + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(loyaltyCodes.id, input.codeId),
        eq(loyaltyCodes.isActive, true),
        isNull(loyaltyCodes.revokedAt),
        or(isNull(loyaltyCodes.usageLimit), sql`${loyaltyCodes.usageCount} < ${loyaltyCodes.usageLimit}`)
      )
    )
    .returning({ id: loyaltyCodes.id });

  if (updated.length === 0) {
    // Lost a race (revoked / limit consumed concurrently) — fail the whole
    // booking transaction rather than granting an unvalidated discount.
    throw new Error('CODE_REDEMPTION_CONFLICT');
  }

  await tx.insert(loyaltyCodeRedemptions).values({
    codeId: input.codeId,
    bookingId: input.bookingId,
    customerId: input.customerId,
    discountAmount: input.discountAmount,
  });
}

/**
 * Booking-side snapshot convenience: given a booking row, compute the deposit
 * from the FINAL total (discount applied). Kept next to redemption logic so
 * the deposit rule placement lives in one place.
 */
export function depositFromFinalTotal(finalTotal: number): number {
  const DEPOSIT_PERCENTAGE = 0.5;
  const DEFAULT_DEPOSIT = 500000;
  return Math.max(Math.round(finalTotal * DEPOSIT_PERCENTAGE), DEFAULT_DEPOSIT);
}

/** True when the booking used a code — used by analytics + admin surfaces. */
export async function bookingHasDiscount(bookingId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), sql`${bookings.discountAmount} IS NOT NULL`));
  return Boolean(row);
}
