import { db } from '@/lib/db';
import { payments, bookings, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { formatLagosTime } from '@/lib/timezone';
import PaymentsManager from './PaymentsManager';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage() {
  const bookingOptions = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      appointmentDate: bookings.appointmentDate,
      startTime: bookings.startTime,
      status: bookings.status,
      customerName: users.name,
      customerEmail: users.email,
      customerPhone: users.phone,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.customerId))
    .orderBy(desc(bookings.appointmentDate), desc(bookings.startTime))
    .limit(500);

  const recent = await db.query.payments.findMany({
    orderBy: [desc(payments.createdAt)],
    limit: 100,
  });

  const bookingRefs = new Map<string, string>();
  for (const payment of recent) {
    if (!bookingRefs.has(payment.bookingId)) {
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, payment.bookingId),
      });
      bookingRefs.set(payment.bookingId, booking?.reference || 'Unknown');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-600">Record deposits, balances, and other payments manually</p>
      </div>

      <PaymentsManager
        bookingOptions={bookingOptions}
        recentPayments={recent.map((p) => ({
          id: p.id,
          bookingId: p.bookingId,
          bookingReference: bookingRefs.get(p.bookingId) || '—',
          amount: p.amount,
          paymentType: p.paymentType,
          note: p.note,
          createdAt: formatLagosTime(new Date(p.createdAt), 'MMM d, yyyy h:mm a'),
        }))}
      />
    </div>
  );
}
