import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { bookings, notifications, emailEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '@/lib/auth/types';
import { queueEmailEvent, dispatchEmailEvent } from '@/lib/email/events';
import { getBookingById } from '@/lib/booking';

// Valid transitions per booking-rules.md:
// pending -> confirmed | rejected | cancelled
// confirmed -> completed | no_show | cancelled
const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel', 'complete', 'no_show']),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  approve: ['pending'],
  reject: ['pending'],
  cancel: ['pending', 'confirmed'],
  complete: ['confirmed'],
  no_show: ['confirmed'],
};

const TARGET_STATUS: Record<string, string> = {
  approve: 'confirmed',
  reject: 'rejected',
  cancel: 'cancelled',
  complete: 'completed',
  no_show: 'no_show',
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();

    const { id } = await params;

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { action } = parsed.data;
    const targetStatus = TARGET_STATUS[action];

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, id),
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (!ALLOWED_TRANSITIONS[action].includes(booking.status)) {
      return NextResponse.json(
        { error: `Cannot ${action} a ${booking.status} booking` },
        { status: 400 }
      );
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      const updateValues: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: now,
      };
      if (targetStatus === 'cancelled') updateValues.cancelledAt = now;
      if (targetStatus === 'completed') updateValues.completedAt = now;

      await tx.update(bookings).set(updateValues).where(eq(bookings.id, id));

      await tx.insert(notifications).values({
        id: uuidv4(),
        type: `booking_${targetStatus}`,
        bookingId: id,
        customerId: booking.customerId,
        title: `Booking ${targetStatus.replace('_', ' ')}`,
        message: `Booking ${booking.reference} was ${targetStatus.replace('_', ' ')} by admin`,
        isRead: false,
        createdAt: now,
      });

      // No rejection email is required per requirements; others get emails.
      if (action !== 'reject') {
        const eventType =
          action === 'approve'
            ? 'booking.confirmed'
            : action === 'cancel'
              ? 'booking.admin_cancelled'
              : null;

        if (eventType) {
          const customer = await tx.query.users.findFirst({
            where: eq(bookings.customerId, booking.customerId),
          });

          await queueEmailEvent({
            eventType,
            recipient: customer?.email || '',
            bookingId: id,
            payload: {
              customerName: customer?.name || 'Customer',
              reference: booking.reference,
              date: booking.appointmentDate,
              startTime: booking.startTime,
              endTime: booking.endTime,
            },
          });
        }
      }
    });

    // Best-effort async dispatch
    const queued = await db
      .select({ id: emailEvents.id })
      .from(emailEvents)
      .where(eq(emailEvents.bookingId, id));
    for (const event of queued) {
      dispatchEmailEvent(event.id);
    }

    void admin;

    return NextResponse.json({ success: true, status: targetStatus });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin booking action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;
    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ booking });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin booking fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
