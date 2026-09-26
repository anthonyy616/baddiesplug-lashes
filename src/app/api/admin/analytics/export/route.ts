import { NextResponse } from 'next/server';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookingServices, bookings, users } from '@/lib/db/schema';
import { requireAdminSession } from '@/lib/admin-auth';
import { ENGAGEMENT_STATUSES } from '@/lib/booking/lifecycle';

// Engagement metrics include pending/confirmed/approved/completed for
// backward compatibility (same rules as the analytics page).
const eligibleStatuses = ENGAGEMENT_STATUSES;

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET() {
  try {
    await requireAdminSession();

    const [statusRows, serviceRows, peakRows, repeatRows] = await Promise.all([
      db.select({ status: bookings.status, count: sql<number>`count(*)` })
        .from(bookings)
        .groupBy(bookings.status)
        .orderBy(desc(sql`count(*)`)),
      db.select({ serviceName: bookingServices.serviceNameSnapshot, count: sql<number>`count(*)` })
        .from(bookingServices)
        .innerJoin(bookings, eq(bookings.id, bookingServices.bookingId))
        .where(inArray(bookings.status, eligibleStatuses as unknown as string[]))
        .groupBy(bookingServices.serviceNameSnapshot)
        .orderBy(desc(sql`count(*)`)),
      db.select({ startTime: bookings.startTime, count: sql<number>`count(*)` })
        .from(bookings)
        .where(inArray(bookings.status, eligibleStatuses as unknown as string[]))
        .groupBy(bookings.startTime)
        .orderBy(desc(sql`count(*)`)),
      db.select({ name: users.name, email: users.email, phone: users.phone, count: sql<number>`count(*)` })
        .from(bookings)
        .innerJoin(users, eq(users.id, bookings.customerId))
        .where(inArray(bookings.status, eligibleStatuses as unknown as string[]))
        .groupBy(users.id, users.name, users.email, users.phone)
        .having(sql`count(*) > 1`)
        .orderBy(desc(sql`count(*)`)),
    ]);

    const rows = [
      ['Section', 'Metric', 'Value', 'Count'],
      ...statusRows.map((row) => ['Booking Status', row.status, '', Number(row.count)]),
      ...serviceRows.map((row) => ['Popular Services', row.serviceName, '', Number(row.count)]),
      ...peakRows.map((row) => ['Peak Hours', row.startTime, '', Number(row.count)]),
      ...repeatRows.map((row) => ['Repeat Customers', row.name, `${row.email}${row.phone ? ` / ${row.phone}` : ''}`, Number(row.count)]),
    ];

    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="baddies-plug-analytics.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Analytics export error:', error);
    return NextResponse.json({ error: 'Failed to export analytics' }, { status: 500 });
  }
}