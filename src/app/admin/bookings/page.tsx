import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { bookings, users } from '@/lib/db/schema';
import { eq, desc, and, or } from 'drizzle-orm';
import Link from 'next/link';
import { formatLagosTime, getCurrentLagosDate } from '@/lib/timezone';
import BookingActions from '@/components/admin/BookingActions';
import { pendingBookings, confirmedBookings, cancelledBookings, rejectedBookings, completedBookings, noShowBookings, todayBookings } from '@/lib/admin/bookings';

interface PageProps {
  searchParams: Promise<{ status?: string; search?: string }>;
}

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const session = await auth();
  const params = await searchParams;
  const status = params.status || 'all';
  const search = params.search || '';

  const [pending, confirmed, cancelled, rejected, completed, noShow, today] = await Promise.all([
    pendingBookings(),
    confirmedBookings(),
    cancelledBookings(),
    rejectedBookings(),
    completedBookings(),
    noShowBookings(),
    todayBookings(),
  ]);

  // Filter by status
  let filteredBookings = [];
  switch (status) {
    case 'pending':
      filteredBookings = pending;
      break;
    case 'confirmed':
      filteredBookings = confirmed;
      break;
    case 'cancelled':
      filteredBookings = cancelled;
      break;
    case 'rejected':
      filteredBookings = rejected;
      break;
    case 'completed':
      filteredBookings = completed;
      break;
    case 'no_show':
      filteredBookings = noShow;
      break;
    case 'today':
      filteredBookings = today;
      break;
    default:
      filteredBookings = [...pending, ...confirmed, ...today];
  }

  // Apply search filter
  if (search) {
    filteredBookings = filteredBookings.filter((b: any) =>
      b.reference.toLowerCase().includes(search.toLowerCase()) ||
      b.customerName?.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Get unique statuses
  const statuses = new Set(filteredBookings.map((b: any) => b.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600">Manage all appointments</p>
        </div>

        <div className="flex gap-4">
          {/* Search */}
          <form action="" className="relative">
            <input
              type="text"
              name="search"
              placeholder="Search by reference or customer..."
              className="pl-10 pr-4 py-2 border border-black rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-burgundy"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </form>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
        <Link
          href={`/admin/bookings?status=all`}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            status === 'all' ? 'bg-burgundy text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          All
        </Link>
        <Link
          href={`/admin/bookings?status=pending`}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            status === 'pending' ? 'bg-burgundy text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Pending
        </Link>
        <Link
          href={`/admin/bookings?status=today`}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            status === 'today' ? 'bg-burgundy text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Today
        </Link>
        <Link
          href={`/admin/bookings?status=confirmed`}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            status === 'confirmed' ? 'bg-burgundy text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Confirmed
        </Link>
        <Link
          href={`/admin/bookings?status=completed`}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            status === 'completed' ? 'bg-burgundy text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Completed
        </Link>
        <Link
          href={`/admin/bookings?status=cancelled`}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            status === 'cancelled' ? 'bg-burgundy text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Cancelled
        </Link>
        <Link
          href={`/admin/bookings?status=rejected`}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            status === 'rejected' ? 'bg-burgundy text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Rejected
        </Link>
        <Link
          href={`/admin/bookings?status=no_show`}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            status === 'no_show' ? 'bg-burgundy text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          No-Show
        </Link>
      </div>

      {/* Bookings List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No bookings found
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking: any) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BookingRow({ booking }: { booking: any }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    rejected: 'bg-gray-100 text-gray-800',
    completed: 'bg-blue-100 text-blue-800',
    no_show: 'bg-gray-100 text-gray-800',
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-4 whitespace-nowrap">
        <Link href={`/admin/bookings/${booking.id}`} className="font-medium text-burgundy hover:text-burgundy/80">
          {booking.reference}
        </Link>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{booking.customerName || 'Unknown'}</div>
        <div className="text-sm text-gray-500">{booking.phone}</div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
        {formatLagosTime(new Date(booking.appointmentDate + 'T00:00:00'), 'MMM d, yyyy')}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
        {booking.startTime} - {booking.endTime}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        ₦{(booking.total / 100).toFixed(2)}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[booking.status] || 'bg-gray-100 text-gray-800'}`}>
          {booking.status.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
        <BookingActions booking={booking} />
      </td>
    </tr>
  );
}
