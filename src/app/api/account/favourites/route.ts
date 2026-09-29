import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getFavouriteServices,
  addFavouriteService,
  removeFavouriteService,
} from '@/lib/favourites';

/**
 * Customer favourites API (Stage 3).
 * All operations are scoped to the authenticated customer via the session —
 * customerId is never accepted from the request body.
 */
export async function GET() {
  try {
    const favourites = await getFavouriteServices();
    return NextResponse.json({ favourites });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Favourites GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const serviceId = typeof body?.serviceId === 'string' ? body.serviceId : '';
    if (!serviceId) {
      return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
    }

    const result = await addFavouriteService(serviceId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Favourites POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const serviceId = request.nextUrl.searchParams.get('serviceId');
    if (!serviceId) {
      return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
    }

    const result = await removeFavouriteService(serviceId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Favourites DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
