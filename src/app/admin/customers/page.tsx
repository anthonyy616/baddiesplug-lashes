import { db } from '@/lib/db';
import { users, bookings } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { formatLagosTime } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage() {
  const customers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      createdAt: users.createdAt,
      bookingCount: sql<number>`(select count(*) from ${bookings} where ${bookings.customerId} = ${users.id})`,
    })
    .from(users)
    .where(eq(users.role, 'customer'))
    .orderBy(desc(users.createdAt))
    .limit(500);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-600">Full appointment history is available per customer</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bookings</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {customers.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500 text-sm">No customers yet</td></tr>
            )}
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.email}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.bookingCount}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatLagosTime(new Date(c.createdAt), 'MMM d, yyyy')}
                </td>
                <td className="px-4 py-3 text-right">
                  <a href={`/admin/customers/${c.id}`} className="text-sm text-burgundy hover:underline">
                    View history
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
