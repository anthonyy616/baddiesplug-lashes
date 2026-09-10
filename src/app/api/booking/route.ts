import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/types';
import { createBooking } from '@/lib/booking';
import { isSlotAvailable } from '@/lib/availability';

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // CONNECTION_CLOSED and transient network errors are often resolved by retrying.
      const isTransient =
        lastError.message.includes('CONNECTION_CLOSED') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('ENOTFOUND');
      if (!isTransient || attempt === maxAttempts) throw lastError;
      const delay = Math.min(100 * 2 ** attempt, 2000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError!;
}

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

    // Fast pre-check: validate the slot is available before doing the heavier
    // pricing/transaction work. This uses the in-request cache so it's cheap.
    const slotCheck = await isSlotAvailable(date, startTime, endTime);
    if (!slotCheck.available) {
      return NextResponse.json(
        { success: false, error: 'slot_no_longer_available' },
        { status: 400 },
      );
    }

    // Create booking with retry for transient connection errors
    const result = await withRetry(() =>
      createBooking(
        serviceIds,
        addonIds || [],
        date,
        startTime,
        endTime,
        phone,
        notes
      ),
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        bookingId: result.bookingId,
        reference: result.reference,
        whatsappUrl: result.whatsappUrl,
      });
    } else {
      // Map specific errors to appropriate status codes
      if (result.error === 'slot_no_longer_available') {
        return NextResponse.json({ success: false, error: result.error }, { status: 409 });
      }
      if (result.error === 'At least one service is required') {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Failed to create booking' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Booking error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message.includes('CONNECTION_CLOSED') || message.includes('ECONNRESET')) {
      return NextResponse.json(
        { success: false, error: 'Temporary connection issue. Please try again in a moment.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
