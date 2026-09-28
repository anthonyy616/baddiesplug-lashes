import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/types';
import { db } from '@/lib/db';
import { bookings, notifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { ConcurrencyConflictError } from '@/lib/booking';
import { recordBookingEvent } from '@/lib/booking/audit';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireAuth();

    const { id } = await params;

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check ownership
    if (booking.customerId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if cancellable (pending/confirmed/approved occupy slots; cancelled is idempotent-blocked)
    if (
      booking.status !== 'pending' &&
      booking.status !== 'confirmed' &&
      booking.status !== 'approved'
    ) {
      return NextResponse.json({ error: 'Booking cannot be cancelled' }, { status: 400 });
    }

    // Check cancellation cutoff (1 hour before appointment)
    if (booking.status === 'confirmed' || booking.status === 'approved') {
      const appointmentEnd = new Date(booking.appointmentDate + 'T' + booking.endTime);
      const oneHourBefore = new Date(appointmentEnd.getTime() - 60 * 60 * 1000);

      if (new Date() > oneHourBefore) {
        return NextResponse.json({ error: 'Cancellation cutoff passed' }, { status: 400 });
      }
    }

    // Concurrency guard: re-check the status in the WHERE clause so a racing
    // cancel or admin action cannot double-apply. Exactly one request wins.
    const cancelled = await db.update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, id), eq(bookings.status, booking.status)))
      .returning({ id: bookings.id });

    if (cancelled.length === 0) {
      return NextResponse.json(
        { error: 'Booking was updated by another action. Refresh and try again.' },
        { status: 409 },
      );
    }

    await recordBookingEvent(
      {
        bookingId: id,
        eventType: 'cancelled',
        actorType: 'customer',
        actorId: session.user.id,
        metadata: { reference: booking.reference },
      },
    );

    // Create notification
    await db.insert(notifications).values({
      id: uuidv4(),
      type: 'booking_cancelled',
      bookingId: id,
      customerId: booking.customerId,
      title: 'Booking Cancelled',
      message: `Booking ${booking.reference} has been cancelled`,
      isRead: false,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      return NextResponse.json({ error: 'Booking was modified concurrently' }, { status: 409 });
    }
    console.error('Error cancelling booking:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
