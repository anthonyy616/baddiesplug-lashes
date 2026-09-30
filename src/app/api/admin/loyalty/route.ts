import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import {
  createLoyaltyCode,
  listLoyaltyCodes,
  setLoyaltyCodeActive,
  revokeLoyaltyCode,
  deleteLoyaltyCode,
  getLoyaltyCodeRedemptions,
  normalizeCode,
} from '@/lib/loyalty';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Loyalty + promotional codes (Stage 10) — admin management.
 *
 * GET    /api/admin/loyalty                 → all codes (+ redemption counts) + customers
 * POST   /api/admin/loyalty                 → create loyalty (customer-bound) or promo code
 * PATCH  /api/admin/loyalty                 → activate/deactivate or revoke
 * GET    /api/admin/loyalty?redemptionsFor= → per-use redemption inspection
 */

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession();

    const redemptionsFor = request.nextUrl.searchParams.get('redemptionsFor');
    if (redemptionsFor) {
      if (!/^[0-9a-f-]{36}$/i.test(redemptionsFor)) {
        return NextResponse.json({ error: 'Invalid or missing code id' }, { status: 400 });
      }
      return NextResponse.json({ redemptions: await getLoyaltyCodeRedemptions(redemptionsFor) });
    }

    const [codes, customerRows] = await Promise.all([
      listLoyaltyCodes(),
      db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.role, 'customer'))
        .orderBy(users.name),
    ]);

    return NextResponse.json({ codes, customers: customerRows });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Loyalty GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession();

    const body = (await request.json()) as {
      code?: string;
      codeType?: string;
      customerId?: string | null;
      discountPercent?: number;
      applicableServiceIds?: string[] | null;
      startsAt?: string | null;
      expiresAt?: string | null;
      usageLimit?: number | null;
      note?: string | null;
    };

    if (typeof body.code !== 'string' || !body.code.trim()) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }
    if (body.codeType !== 'loyalty' && body.codeType !== 'promo') {
      return NextResponse.json({ error: 'codeType must be loyalty or promo' }, { status: 400 });
    }
    if (
      typeof body.discountPercent !== 'number' ||
      !Number.isInteger(body.discountPercent) ||
      body.discountPercent < 1 ||
      body.discountPercent > 100
    ) {
      return NextResponse.json(
        { error: 'discountPercent must be an integer between 1 and 100' },
        { status: 400 }
      );
    }

    let customerId: string | null = null;
    if (body.codeType === 'loyalty') {
      if (!body.customerId || !/^[0-9a-f-]{36}$/i.test(body.customerId)) {
        return NextResponse.json(
          { error: 'Loyalty codes require a valid customerId' },
          { status: 400 }
        );
      }
      const [customer] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, body.customerId));
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 400 });
      }
      customerId = body.customerId;
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: 'Invalid startsAt' }, { status: 400 });
    }
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json({ error: 'Invalid expiresAt' }, { status: 400 });
    }

    // Note: admin sessions are standalone (username string, not a users row),
    // so createdByAdminId stays null — the acting admin is captured in `note`
    // when the manager passes one.
    const result = await createLoyaltyCode({
      code: normalizeCode(body.code),
      codeType: body.codeType,
      customerId,
      discountPercent: body.discountPercent,
      applicableServiceIds: Array.isArray(body.applicableServiceIds)
        ? body.applicableServiceIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id))
        : null,
      startsAt,
      expiresAt,
      usageLimit: body.usageLimit ?? null,
      note: body.note ?? null,
      createdByAdminId: null,
    });
    void admin;

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, code: result.record }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Loyalty POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminSession();

    const body = (await request.json()) as {
      id?: string;
      isActive?: boolean;
      revoke?: boolean;
    };

    if (!body.id || !/^[0-9a-f-]{36}$/i.test(body.id)) {
      return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 });
    }

    const ok = body.revoke
      ? await revokeLoyaltyCode(body.id)
      : typeof body.isActive === 'boolean'
        ? await setLoyaltyCodeActive(body.id, body.isActive)
        : null;

    if (ok === null) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    if (!ok) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Loyalty PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminSession();

    const id = request.nextUrl.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 });
    }

    const result = await deleteLoyaltyCode(id);
    if (result === 'not_found') {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Loyalty DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete code' }, { status: 500 });
  }
}
