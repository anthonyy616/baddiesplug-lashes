import { db } from '@/lib/db';
import { users, bookings } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { formatLagosTime } from '@/lib/timezone';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminCustomerHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await db.query.users.findFirst({
    where: eq(users.id, id),
  });
  if (!customer) {
    notFound();
  }

  const history = await db.query.bookings.findMany({
    where: eq(bookings.customerId, id),
    orderBy: [desc(bookings.createdAt)],
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    rejected: 'bg-gray-100 text-gray-800',
    completed: 'bg-blue-100 text-blue-800',
    no_show: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
          <p className="text-gray-600">
            {customer.email} · {customer.phone || 'No phone on file'}
          </p>
        </div>
        <Link
          href="/admin/customers"
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
        >
          Back
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Full Appointment History ({history.length})</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Appointment</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {history.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500 text-sm">No bookings</td></tr>
            )}
            {history.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/bookings/${b.id}`} className="font-mono text-sm text-burgundy hover:underline">
                    {b.reference}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {b.appointmentDate} · {b.startTime}–{b.endTime}
                </td>
                <td className="px-4 py-3 text-sm">₦{(b.total / 100).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${statusColors[b.status] || 'bg-gray-100 text-gray-800'}`}>
                    {b.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatLagosTime(new Date(b.createdAt), 'MMM d, yyyy')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
