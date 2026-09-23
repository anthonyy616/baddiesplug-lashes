import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots, clearRequestCache } from '@/lib/availability';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ 
        error: 'Date parameter is required' 
      }, { status: 400 });
    }

    const slots = await getAvailableSlots(date);
    return NextResponse.json({ slots });
  } catch (error) {
    // Surface real failures as 500s. Returning { slots: [] } here (the old
    // behavior) masked outages as "fully booked" days and made the bug in
    // Sep 2026 impossible to spot from logs — a 200 with empty slots looks
    // identical to a legitimately closed day.
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 },
    );
  } finally {
    // Prevent stale in-request cache from leaking across unrelated calls
    // in long-lived Node dev servers or when multiple routes share a process.
    clearRequestCache();
  }
}
