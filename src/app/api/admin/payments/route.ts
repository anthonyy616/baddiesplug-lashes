import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { payments, bookings } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getPaymentProvider } from '@/lib/payments';
import { requireAdminSession } from '@/lib/admin-auth';

const createSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().int().min(1), // NGN kobo
  paymentType: z.enum(['deposit', 'balance', 'other']),
  note: z.string().max(500).optional(),
});

export async function GET() {
  try {
    await requireAdminSession();

    const all = await db.query.payments.findMany({
      orderBy: [desc(payments.createdAt)],
      limit: 200,
    });

    return NextResponse.json({ payments: all });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin payments GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 });
    }

    // Verify booking exists
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parsed.data.bookingId),
    });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const provider = getPaymentProvider();
    const created = await provider.recordPayment(
      parsed.data.bookingId,
      parsed.data.amount,
      parsed.data.paymentType,
      parsed.data.note,
      admin
    );

    return NextResponse.json({ success: true, payment: created });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin payments POST error:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
