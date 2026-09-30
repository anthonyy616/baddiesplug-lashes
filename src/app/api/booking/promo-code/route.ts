import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/types';
import { hasUsableCodesForCustomer, validateAndApplyCode, normalizeCode } from '@/lib/loyalty';

/**
 * Customer-facing promo code surface for the booking flow.
 *
 * GET  /api/booking/promo-code
 *   → { hasUsableCodes: boolean } — gates whether the UI shows the field at
 *     all. False when the customer has no code, or every code they could use
 *     is deactivated/revoked/expired/exhausted.
 *
 * POST /api/booking/promo-code   { code, serviceIds }
 *   → server-side PREVIEW only: validates the code and returns the computed
 *     discount. Nothing is persisted; redemption happens exclusively inside
 *     the booking transaction when the booking is created.
 */

export async function GET() {
  try {
    const user = await requireAuth();
    const hasUsableCodes = await hasUsableCodesForCustomer(user.id);
    return NextResponse.json({ hasUsableCodes });
  } catch {
    return NextResponse.json({ hasUsableCodes: false });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = (await request.json()) as { code?: string; serviceIds?: string[] };
    const code = typeof body.code === 'string' ? body.code : '';
    const serviceIds = Array.isArray(body.serviceIds)
      ? body.serviceIds.filter((id): id is string => typeof id === 'string')
      : [];

    // Recompute subtotal from the catalogue server-side — never trust a
    // client-supplied amount.
    const { calculateBookingTotal } = await import('@/lib/pricing');
    const priceSnapshot = await calculateBookingTotal(serviceIds, []);

    const result = await validateAndApplyCode({
      code,
      customerId: user.id,
      serviceIds,
      subtotal: priceSnapshot.subtotal,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      code: normalizeCode(code),
      discountPercent: result.discountPercent,
      discountAmount: result.discountAmount,
      finalTotal: result.finalTotal,
      deposit: Math.max(Math.round(result.finalTotal * 0.5), result.finalTotal > 0 ? 500000 : 0),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Promo code preview error:', error);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
