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
    console.error('Error fetching availability:', error);
    return NextResponse.json({ 
      slots: [] 
    });
  } finally {
    // Prevent stale in-request cache from leaking across unrelated calls
    // in long-lived Node dev servers or when multiple routes share a process.
    clearRequestCache();
  }
}
