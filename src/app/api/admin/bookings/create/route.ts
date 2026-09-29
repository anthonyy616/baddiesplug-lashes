import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, desc, ilike, or, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/types';
import { adminCreateBooking } from '@/lib/booking/admin-create';

/**
 * ADMIN CUSTOM BOOKING CREATION (Stage 2) + customer lookup.
 *
 * POST creates a booking administratively for an existing customer (WhatsApp,
 * walk-in, manually arranged). All business rules run through the shared
 * domain service — server-side pricing, snapshots, slot validation, unique
 * slot protection, audit events, durable email.
 *
 * GET searches existing customers for the booking form.
 */

const createSchema = z.object({
  customerId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1),
  addonIds: z.array(z.string().uuid()).default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  phone: z.string().min(10).max(20),
  customerNotes: z.string().max(2000).optional(),
  adminNotes: z.string().max(2000).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) {
      return NextResponse.json({ customers: [] });
    }

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(
        and(
          eq(users.role, 'customer'),
          or(
            ilike(users.name, `%${q}%`),
            ilike(users.email, `%${q}%`),
            ilike(users.phone, `%${q}%`)
          )
        )
      )
      .orderBy(desc(users.createdAt))
      .limit(10);

    return NextResponse.json({ customers: rows });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin customer search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
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
        { status: 400 }
      );
    }

    const result = await adminCreateBooking(parsed.data);

    if (result.success) {
      return NextResponse.json({
        success: true,
        bookingId: result.bookingId,
        reference: result.reference,
        whatsappUrl: result.whatsappUrl,
      });
    }

    if (result.error === 'slot_not_available') {
      return NextResponse.json(
        { success: false, error: result.error, details: result.errorDetail },
        { status: 409 }
      );
    }
    if (result.error === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: result.error || 'Failed to create booking' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin booking creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
