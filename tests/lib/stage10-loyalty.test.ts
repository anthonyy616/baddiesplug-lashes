import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('loyalty migration (Stage 10)', () => {
  it('0017 migration exists, registered after 0016, forward-only', () => {
    const sql = read('db/migrations/0017_loyalty_codes.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "loyalty_codes"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "loyalty_code_redemptions"');
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE/i);
    const journal = JSON.parse(read('db/migrations/meta/_journal.json'));
    const tags = journal.entries.map((e: { tag: string }) => e.tag);
    expect(tags.indexOf('0017_loyalty_codes')).toBeGreaterThan(
      tags.indexOf('0016_availability_rules')
    );
  });

  it('bookings gain discount snapshot columns, catalogue totals untouched', () => {
    const sql = read('db/migrations/0017_loyalty_codes.sql');
    for (const col of ['discount_code', 'discount_amount', 'final_total']) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS "${col}"`);
    }
    // No destructive rewrites of existing columns.
    expect(sql).not.toMatch(/ALTER TABLE "bookings"\s+(ALTER|DROP)/i);
  });

  it('migration columns match the Drizzle schema (snake_case)', () => {
    const sql = read('db/migrations/0017_loyalty_codes.sql');
    for (const col of [
      'code_type',
      'customer_id',
      'discount_percent',
      'applicable_service_ids',
      'starts_at',
      'expires_at',
      'usage_limit',
      'usage_count',
      'is_active',
      'revoked_at',
      'created_by_admin_id',
    ]) {
      expect(sql).toContain(`"${col}"`);
    }
    // camelCase leftovers would silently break the schema mapping.
    expect(sql).not.toMatch(/"(codeType|discountPercent|usageLimit|usageCount|isActive|revokedAt)"/);
  });
});

describe('server-side validation (Stage 10)', () => {
  const src = () => read('src/lib/loyalty/index.ts');

  it('one loyalty module owns validation; guard chain covers every rule', () => {
    const s = src();
    expect(s).toContain('export async function validateAndApplyCode');
    // Guard chain: existence, ownership, active, revocation, window, limit, scope.
    expect(s).toContain("error: 'not_found'");
    expect(s).toContain("error: 'ownership'");
    expect(s).toContain("error: 'inactive'");
    expect(s).toContain("error: 'revoked'");
    expect(s).toContain("error: 'not_started'");
    expect(s).toContain("error: 'expired'");
    expect(s).toContain("error: 'usage_limit'");
    expect(s).toContain("error: 'service_mismatch'");
  });

  it('loyalty codes are ownership-bound; promo codes are general', () => {
    const s = src();
    expect(s).toMatch(/codeType === 'loyalty' && record\.customerId !== input\.customerId/);
  });

  it('discount math derives from server-supplied subtotal, capped at subtotal', () => {
    const s = src();
    expect(s).toMatch(/input\.subtotal \* record\.discountPercent\) \/ 100/);
    expect(s).toMatch(/Math\.min\([\s\S]*input\.subtotal/);
  });

  it('redemption is atomic with the booking: usage guard re-checked in tx', () => {
    const s = src();
    expect(s).toContain('export async function recordRedemption');
    expect(s).toMatch(/usage_count[\s\S]*usageLimit/);
    // Conflict throws so the WHOLE booking transaction rolls back.
    expect(s).toContain('CODE_REDEMPTION_CONFLICT');
    expect(s).toContain('tx.insert(loyaltyCodeRedemptions)');
  });

  it('deposit rule applies AFTER the discount', () => {
    const s = src();
    expect(s).toContain('depositFromFinalTotal');
    expect(s).toMatch(/finalTotal \* DEPOSIT_PERCENTAGE/);
  });
});

describe('booking integration (Stage 10)', () => {
  it('createBooking validates the code server-side and snapshots results', () => {
    const s = read('src/lib/booking/index.ts');
    expect(s).toContain("from '@/lib/loyalty'");
    expect(s).toMatch(/validateAndApplyCode\(\{[\s\S]*subtotal: priceSnapshot\.subtotal/);
    // Booking insert snapshots the three columns; catalogue total stays.
    expect(s).toContain('discountCode: discount?.code ?? null');
    expect(s).toContain('discountAmount: discount?.discountAmount ?? null');
    expect(s).toContain('finalTotal: discount?.finalTotal ?? null');
    expect(s).toMatch(/depositRequired: payableDeposit/);
    // Redemption recorded INSIDE the transaction.
    expect(s).toMatch(/recordRedemption\([\s\S]*tx\s*\n\s*\)/);
    // Client-computed discounts never enter the calculation.
    expect(s).not.toMatch(/discount.*req\.body|body\.discount[A-Z]\w+ amount/i);
  });

  it('API accepts only the code string; discount failures surface as 400', () => {
    const api = read('src/app/api/booking/route.ts');
    expect(api).toMatch(/discountCode: z/);
    expect(api).toMatch(/result\.error\?\.startsWith\('discount_code_'\)/);
  });
});

describe('admin + customer surfaces (Stage 10)', () => {
  it('admin CRUD API is admin-guarded with code type + percent validation', () => {
    const api = read('src/app/api/admin/loyalty/route.ts');
    expect(api).toContain('requireAdminSession');
    expect(api).toContain("body.codeType !== 'loyalty' && body.codeType !== 'promo'");
    expect(api).toMatch(/discountPercent < 1 \|\|[\s\S]*discountPercent > 100/);
  });

  it('admin manager supports create, activate/deactivate, revoke, usage inspection', () => {
    const ui = read('src/app/admin/loyalty/LoyaltyManager.tsx');
    expect(ui).toContain('Deactivate');
    expect(ui).toContain('Activate');
    expect(ui).toContain('Revoke');
    expect(ui).toContain('redemptionsFor');
  });

  it('admin page + nav entry exist', () => {
    expect(read('src/app/admin/loyalty/page.tsx')).toContain('LoyaltyManager');
    expect(read('src/components/admin/AdminNav.tsx')).toContain("href: '/admin/loyalty'");
  });

  it('customer account has a read-only Rewards section', () => {
    const rewards = read('src/components/account/RewardsSection.tsx');
    expect(rewards).toContain('getCustomerCodes');
    // Read-only: no mutation calls in the customer rewards component.
    expect(rewards).not.toMatch(/fetch\(|POST|PATCH/);
    expect(read('src/app/account/page.tsx')).toContain('RewardsSection');
  });

  it('analytics getDiscountImpact reads real booking discount snapshots', () => {
    const v2 = read('src/lib/analytics/v2.ts');
    expect(v2).toMatch(/getDiscountImpact\(range: AnalyticsRange\)/);
    expect(v2).toContain('bookings.discountAmount');
    // The neutral stub signature must be gone.
    expect(v2).not.toContain('_range: AnalyticsRange');
  });
});
