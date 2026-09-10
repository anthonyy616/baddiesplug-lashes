import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/types';
import { createBooking } from '@/lib/booking';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const { serviceIds, addonIds, date, startTime, endTime, phone, notes } = body;

    // Validate required fields
    if (!serviceIds || !date || !startTime || !endTime || !phone) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Create booking
    const result = await createBooking(
      serviceIds,
      addonIds || [],
      date,
      startTime,
      endTime,
      phone,
      notes
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        bookingId: result.bookingId,
        reference: result.reference,
        whatsappUrl: result.whatsappUrl,
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Failed to create booking' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Booking error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
