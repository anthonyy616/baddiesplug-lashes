import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/types';
import { db } from '@/lib/db';
import { bookings, notifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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

    // Check if cancellable
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Booking cannot be cancelled' }, { status: 400 });
    }

    // Check cancellation cutoff (1 hour before appointment)
    if (booking.status === 'confirmed') {
      const appointmentEnd = new Date(booking.appointmentDate + 'T' + booking.endTime);
      const oneHourBefore = new Date(appointmentEnd.getTime() - 60 * 60 * 1000);

      if (new Date() > oneHourBefore) {
        return NextResponse.json({ error: 'Cancellation cutoff passed' }, { status: 400 });
      }
    }

    // Update booking status
    await db.update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id));

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
    console.error('Error cancelling booking:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
