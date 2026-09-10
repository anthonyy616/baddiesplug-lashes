import { auth } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/types';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import { getCustomerBookings } from '@/lib/booking';
import { formatLagosTime } from '@/lib/timezone';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import CustomerNotifications from '@/components/account/CustomerNotifications';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await auth();
  const user = session?.user as any;

  if (!user) {
    redirect('/auth/signin');
  }

  await requireAuth();

  // Unread customer notification count for header
  let unreadCount = 0;
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.customerId, user.id),
          eq(notifications.isRead, false)
        )
      );
    unreadCount = result[0]?.count || 0;
  } catch {
    unreadCount = 0;
  }

  // Returns only upcoming/current bookings — customers never see appointment history
  const bookings = await getCustomerBookings(user.id);

  const statusBadge: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    rejected: 'bg-gray-100 text-gray-800',
  };

  const statusLabel: Record<string, string> = {
    pending: 'Pending approval',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled — contact us on WhatsApp about refunds',
    rejected: 'Not approved',
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Account</h1>
              {unreadCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-burgundy/10 text-burgundy text-sm rounded-full ml-4">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </span>
              )}
              <p className="text-gray-600 dark:text-gray-400">Welcome back, {user?.name}</p>
            </div>
            <Link
              href="/services"
              className="text-burgundy hover:text-burgundy/80"
            >
              Browse services
            </Link>
          </div>
        </div>

        <CustomerNotifications />

        {/* Current Bookings */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">My Bookings</h2>

          {bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>You have no upcoming bookings.</p>
              <Link
                href="/booking"
                className="inline-block mt-4 px-4 py-2 bg-burgundy text-white rounded-lg hover:bg-burgundy/90"
              >
                Book an Appointment
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking: any) => (
                <Link
                  key={booking.id}
                  href={`/account/bookings/${booking.id}`}
                  className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${statusBadge[booking.status] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {booking.status.replace('_', ' ')}
                        </span>
                        <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                          {booking.reference}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {formatLagosTime(new Date(booking.appointmentDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')} at {booking.startTime}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">₦{(booking.total / 100).toFixed(2)}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {statusLabel[booking.status] || ''}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
