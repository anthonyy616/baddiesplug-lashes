import { auth } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/types';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCustomerBookings } from '@/lib/booking';
import { formatLagosTime, getCurrentLagosDate, parseSlotToDateTime } from '@/lib/timezone';
import { desc } from 'drizzle-orm';

export default async function AccountPage() {
  const session = await auth();
  const user = session?.user as any;

  if (!user) {
    redirect('/auth/signin');
  }

  await requireAuth();

  const bookings = await getCustomerBookings(user.id);

  // Sort bookings by created date descending
  const sortedBookings = [...bookings].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
              <p className="text-gray-600">Welcome back, {user?.name}</p>
            </div>
            <Link
              href="/auth/signin"
              className="text-burgundy hover:text-burgundy/80"
            >
              Sign out
            </Link>
          </div>
        </div>

        {/* My Bookings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">My Bookings</h2>

          {bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>You haven't made any bookings yet.</p>
              <Link
                href="/booking"
                className="inline-block mt-4 px-4 py-2 bg-burgundy text-white rounded-lg hover:bg-burgundy/90"
              >
                Book an Appointment
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedBookings.map((booking: any) => (
                <Link
                  key={booking.id}
                  href={`/account/bookings/${booking.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          booking.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          booking.status === 'rejected' ? 'bg-gray-100 text-gray-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.status.replace('_', ' ')}
                        </span>
                        <span className="font-mono text-sm text-gray-600">
                          {booking.reference}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatLagosTime(new Date(booking.appointmentDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')} at {booking.startTime}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">₦{(booking.total / 100).toFixed(2)}</p>
                      <p className="text-sm text-gray-500">
                        {booking.status === 'pending' ? 'Pending approval' :
                         booking.status === 'confirmed' ? 'Confirmed' :
                         booking.status === 'completed' ? 'Completed' :
                         booking.status === 'cancelled' ? 'Cancelled' :
                         booking.status === 'rejected' ? 'Rejected' : ''}
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
