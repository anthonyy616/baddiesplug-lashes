import { db } from '@/lib/db';
import { payments, bookings } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { formatLagosTime } from '@/lib/timezone';
import PaymentsManager from './PaymentsManager';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage() {
  const bookingOptions = await db.query.bookings.findMany({
    where: eq(bookings.status, 'approved'),
    with: { customer: true, services: true },
    orderBy: [desc(bookings.appointmentDate), desc(bookings.startTime)],
    limit: 500,
  });

  const recent = await db.query.payments.findMany({
    with: { booking: { with: { customer: true, services: true } } },
    orderBy: [desc(payments.createdAt)],
    limit: 100,
  });

  const totals = await db
    .select({ bookingId: payments.bookingId, totalPaid: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .groupBy(payments.bookingId);
  const totalsByBooking = new Map(totals.map((row) => [row.bookingId, Number(row.totalPaid)]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-600">Record deposits, balances, and other payments manually</p>
      </div>

      <PaymentsManager
        bookingOptions={bookingOptions.map((booking) => ({
          id: booking.id,
          reference: booking.reference,
          appointmentDate: booking.appointmentDate,
          startTime: booking.startTime,
          status: booking.status,
          customerName: booking.customer.name,
          customerEmail: booking.customer.email,
          customerPhone: booking.customer.phone,
          serviceNames: booking.services.map((service) => service.serviceNameSnapshot),
          totalPaid: totalsByBooking.get(booking.id) || 0,
        }))}
        recentPayments={recent.map((p) => ({
          id: p.id,
          bookingId: p.bookingId,
          bookingReference: p.booking?.reference || '—',
          appointmentDate: p.booking?.appointmentDate || null,
          customerName: p.booking?.customer.name || 'Unknown',
          serviceNames: p.booking?.services.map((service) => service.serviceNameSnapshot) || [],
          bookingStatus: p.booking?.status || 'unknown',
          amount: p.amount,
          totalPaid: totalsByBooking.get(p.bookingId) || 0,
          paymentType: p.paymentType,
          note: p.note,
          createdAt: formatLagosTime(new Date(p.createdAt), 'MMM d, yyyy h:mm a'),
        }))}
      />
    </div>
  );
}
