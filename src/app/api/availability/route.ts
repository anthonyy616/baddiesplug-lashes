import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/availability';

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
  }
}
