import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/types';
import { createBooking, getBookingBySubmissionKey } from '@/lib/booking';
import { isSlotAvailable } from '@/lib/availability';

const bookingSchema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1),
  addonIds: z.array(z.string().uuid()).default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  phone: z.string().min(10).max(20),
  notes: z.string().max(2000).optional(),
  // Client-generated submission key: repeats of the SAME submission (retry
  // after timeout/5xx/connection reset, double-click) must resolve to the
  // original booking instead of creating a duplicate.
  submissionKey: z.string().min(8).max(64),
});

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
    const parsed = bookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid booking data',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const { serviceIds, addonIds, date, startTime, endTime, phone, notes, submissionKey } =
      parsed.data;

    // Idempotency fast-path: if this exact submission already created a
    // booking (e.g. the response was lost), return the original result.
    const existing = await getBookingBySubmissionKey(submissionKey);
    if (existing) {
      return NextResponse.json({
        success: true,
        bookingId: existing.id,
        reference: existing.reference,
        whatsappUrl: existing.whatsappUrl,
        duplicate: true,
      });
    }

    // Fast pre-check: validate the slot is available before doing the heavier
    // pricing/transaction work. This uses the in-request cache so it's cheap.
    const slotCheck = await isSlotAvailable(date, startTime, endTime);
    if (!slotCheck.available) {
      return NextResponse.json(
        { success: false, error: 'slot_no_longer_available' },
        { status: 409 },
      );
    }

    // Create booking with retry for transient connection errors. The
    // submission key makes retries idempotent server-side.
    const result = await withRetry(() =>
      createBooking(
        serviceIds,
        addonIds,
        date,
        startTime,
        endTime,
        phone,
        notes,
        submissionKey,
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
      if (result.error === 'duplicate_submission') {
        return NextResponse.json({
          success: true,
          bookingId: result.bookingId,
          reference: result.reference,
          whatsappUrl: result.whatsappUrl,
          duplicate: true,
        });
      }
      if (result.error === 'At least one service is required') {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to create booking',
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

/**
 * Reconciliation endpoint: "did my submission go through?" — the client calls
 * this before allowing another submission after a lost response, timeout, or
 * 5xx. Returns the booking created by the given submission key, if any.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const submissionKey = request.nextUrl.searchParams.get('submissionKey');
    if (!submissionKey || submissionKey.length < 8 || submissionKey.length > 64) {
      return NextResponse.json(
        { success: false, error: 'submissionKey is required' },
        { status: 400 },
      );
    }

    const booking = await getBookingBySubmissionKey(submissionKey);
    if (!booking) {
      return NextResponse.json({ success: true, found: false });
    }

    return NextResponse.json({
      success: true,
      found: true,
      bookingId: booking.id,
      reference: booking.reference,
      status: booking.status,
      whatsappUrl: booking.whatsappUrl,
    });
  } catch (error) {
    console.error('Booking reconciliation error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
