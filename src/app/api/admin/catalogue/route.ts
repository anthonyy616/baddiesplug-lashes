import { requireAdmin } from '@/lib/auth/types';
import { getActiveServices, getActiveAddons } from '@/lib/pricing';
import { NextResponse } from 'next/server';

/**
 * Catalogue for the admin booking-creation form (Stage 2).
 * Returns active services and add-ons so the admin picks from the same
 * server-authoritative catalogue the website flow uses. Pricing is NOT sent
 * for recalculation — the server always recalculates at creation time.
 */
export async function GET() {
  try {
    await requireAdmin();

    const [services, addons] = await Promise.all([
      getActiveServices(),
      getActiveAddons(),
    ]);

    return NextResponse.json({
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        subcategory: s.subcategory,
        price: s.price,
        durationMinutes: s.durationMinutes,
      })),
      addons: addons.map((a) => ({
        id: a.id,
        name: a.name,
        price: a.price,
      })),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin catalogue fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
