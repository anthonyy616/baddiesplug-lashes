import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, bookings } from '@/lib/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession();

    const customerId = request.nextUrl.searchParams.get('id');

    // Single customer with full appointment history (admin-only view)
    if (customerId) {
      const customer = await db.query.users.findFirst({
        where: eq(users.id, customerId),
      });
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      const history = await db.query.bookings.findMany({
        where: eq(bookings.customerId, customerId),
        orderBy: [desc(bookings.createdAt)],
      });

      return NextResponse.json({ customer, history });
    }

    // List all customers with booking counts.
    // Typed Drizzle count() with an explicit LEFT JOIN + GROUP BY — replaces
    // the raw sql<number> correlated subquery whose driver result shape
    // (string vs number) made counts render as 0. Number(...) normalizes any
    // bigint/string result so list counts always equal the history query.
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
        bookingCount: count(bookings.id),
      })
      .from(users)
      .leftJoin(bookings, eq(bookings.customerId, users.id))
      .where(eq(users.role, 'customer'))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt))
      .limit(500);

    return NextResponse.json({
      customers: rows.map((r) => ({ ...r, bookingCount: Number(r.bookingCount) })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin customers GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
