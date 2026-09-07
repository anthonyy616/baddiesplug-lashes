import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { bookings, payments } from '@/lib/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import Link from 'next/link';
import { getLagosTime, formatLagosTime, getCurrentLagosDate } from '@/lib/timezone';

export default async function AdminDashboardPage() {
  const session = await auth();
  const user = session?.user as any;

  const today = getCurrentLagosDate();

  // Get statistics
  const [
    totalBookings,
    pendingBookings,
    todayBookings,
    todayRevenue,
    totalCustomers,
  ] = await Promise.all([
    getCount(bookings),
    getCount(bookings, eq(bookings.status, 'pending')),
    getBookingsByDate(today),
    getTodayRevenue(today),
    getCount(bookings, undefined, 'customerId'),
  ]);

  // Get pending bookings for quick action
  const pendingList = await getPendingBookings(5);

  // Get today's appointments
  const todayList = await getTodayBookings(5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.name}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{totalBookings}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Requests</p>
              <p className="text-2xl font-bold text-amber-600">{pendingBookings}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          {pendingBookings > 0 && (
            <Link
              href="/admin/bookings?status=pending"
              className="mt-2 inline-block text-sm text-burgundy hover:text-burgundy/80"
            >
              View pending
            </Link>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today's Appointments</p>
              <p className="text-2xl font-bold text-gray-900">{todayBookings.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today's Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ₦{(todayRevenue / 100).toFixed(2)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Bookings */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Pending Requests</h2>
            <Link
              href="/admin/bookings?status=pending"
              className="text-sm text-burgundy hover:text-burgundy/80"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingList.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No pending bookings
              </div>
            ) : (
              pendingList.map((booking: any) => (
                <div key={booking.id} className="p-4 hover:bg-gray-50">
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{booking.reference}</p>
                        <p className="text-sm text-gray-600">
                          {formatLagosTime(new Date(booking.createdAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">₦{(booking.total / 100).toFixed(2)}</p>
                        <p className="text-sm text-gray-600">{booking.customerName}</p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Appointments */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Today's Appointments</h2>
            <Link
              href="/admin/bookings?status=today"
              className="text-sm text-burgundy hover:text-burgundy/80"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {todayList.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No appointments today
              </div>
            ) : (
              todayList.map((booking: any) => (
                <div key={booking.id} className="p-4 hover:bg-gray-50">
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{booking.reference}</p>
                        <p className="text-sm text-gray-600">
                          {booking.startTime} - {booking.endTime}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.status}
                        </span>
                        <p className="text-sm text-gray-600 mt-1">{booking.customerName}</p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

async function getCount(
  table: any,
  condition?: any,
  column?: string
): Promise<number> {
  try {
    if (condition) {
      const result = await db.select({ count: sql<number>`count(*)` }).from(table).where(condition);
      return result[0]?.count || 0;
    }
    const result = await db.select({ count: sql<number>`count(*)` }).from(table);
    return result[0]?.count || 0;
  } catch {
    return 0;
  }
}

async function getBookingsByDate(date: string) {
  try {
    return await db.query.bookings.findMany({
      where: and(
        eq(bookings.appointmentDate, date),
        or(
          eq(bookings.status, 'confirmed'),
          eq(bookings.status, 'completed')
        )
      ),
      orderBy: [bookings.startTime],
    });
  } catch {
    return [];
  }
}

async function getTodayRevenue(date: string): Promise<number> {
  try {
    const todayBookings = await getBookingsByDate(date);
    return todayBookings.reduce((sum: number, b: any) => sum + (b.total || 0), 0);
  } catch {
    return 0;
  }
}

async function getPendingBookings(limit: number) {
  try {
    const pending = await db.query.bookings.findMany({
      where: eq(bookings.status, 'pending'),
      orderBy: [desc(bookings.createdAt)],
      limit,
    });

    // Get customer names
    return Promise.all(pending.map(async (booking: any) => {
      const customer = await db.query.users.findFirst({
        where: eq(bookings.customerId, booking.customerId),
      });
      return { ...booking, customerName: customer?.name || 'Unknown' };
    }));
  } catch {
    return [];
  }
}

async function getTodayBookings(limit: number) {
  try {
    const today = getCurrentLagosDate();
    const bookingsList = await getBookingsByDate(today);

    // Get customer names
    return Promise.all(bookingsList.slice(0, limit).map(async (booking: any) => {
      const customer = await db.query.users.findFirst({
        where: eq(bookings.customerId, booking.customerId),
      });
      return { ...booking, customerName: customer?.name || 'Unknown' };
    }));
  } catch {
    return [];
  }
}
