import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth/types';
import { db } from '@/lib/db';
import { bookings, notifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireAdmin();

    const { id } = await params;
    const { action } = await request.json();

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    switch (action) {
      case 'approve':
        if (booking.status !== 'pending') {
          return NextResponse.json({ error: 'Only pending bookings can be approved' }, { status: 400 });
        }

        await db.update(bookings)
          .set({
            status: 'confirmed',
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, id));

        // Create notification
        await db.insert(notifications).values({
          id: uuidv4(),
          type: 'booking_approved',
          bookingId: id,
          title: 'Booking Approved',
          message: `Booking ${booking.reference} has been approved`,
          isRead: false,
          createdAt: new Date(),
        });

        return NextResponse.json({ success: true });

      case 'reject':
        if (booking.status !== 'pending') {
          return NextResponse.json({ error: 'Only pending bookings can be rejected' }, { status: 400 });
        }

        await db.update(bookings)
          .set({
            status: 'rejected',
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, id));

        return NextResponse.json({ success: true });

      case 'complete':
        if (booking.status !== 'confirmed') {
          return NextResponse.json({ error: 'Only confirmed bookings can be completed' }, { status: 400 });
        }

        await db.update(bookings)
          .set({
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, id));

        return NextResponse.json({ success: true });

      case 'no_show':
        if (booking.status !== 'confirmed') {
          return NextResponse.json({ error: 'Only confirmed bookings can be marked no-show' }, { status: 400 });
        }

        await db.update(bookings)
          .set({
            status: 'no_show',
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, id));

        return NextResponse.json({ success: true });

      case 'cancel':
        if (booking.status !== 'confirmed' && booking.status !== 'pending') {
          return NextResponse.json({ error: 'Cannot cancel this booking' }, { status: 400 });
        }

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
          title: 'Booking Cancelled',
          message: `Booking ${booking.reference} has been cancelled`,
          isRead: false,
          createdAt: new Date(),
        });

        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error handling booking action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
