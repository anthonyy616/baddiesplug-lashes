import { NextRequest, NextResponse } from 'next/server';
import { getActiveServices, getServiceById } from '@/lib/pricing';

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (id) {
      // Single service by id (used by the booking flow for server-side
      // pre-select and price confirmation).
      const service = await getServiceById(id);
      if (!service) {
        return NextResponse.json({ service: null }, { status: 404 });
      }
      return NextResponse.json({ service });
    }

    const services = await getActiveServices();
    return NextResponse.json({ services });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ services: [] });
  }
}
