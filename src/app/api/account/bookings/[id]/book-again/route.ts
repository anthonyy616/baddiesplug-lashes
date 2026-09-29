import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBookAgainData } from '@/lib/favourites';

/**
 * BOOK AGAIN (Stage 3).
 *
 * Returns pre-fill data for a past booking: service and add-on ids that still
 * exist and are active in the current catalogue. The response contains NO
 * prices (server recalculates from the current catalogue at booking time) and
 * NO slot (the customer must choose a new date/time and pass normal
 * availability + validation in the standard booking flow).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const customerId = session?.user?.id;
    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await getBookAgainData(id, customerId);

    if (!result.success) {
      const status = result.error === 'Unauthorized' ? 403 : 404;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      serviceIds: result.serviceIds ?? [],
      addonIds: result.addonIds ?? [],
      unavailableServiceNames: result.unavailableServiceNames ?? [],
      unavailableAddonNames: result.unavailableAddonNames ?? [],
    });
  } catch (error) {
    console.error('Book again error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
