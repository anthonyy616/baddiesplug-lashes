import { auth } from '@/lib/auth';
import { getBookingById } from '@/lib/booking';
import { requireAuth } from '@/lib/auth/types';
import { redirect } from 'next/navigation';
import { formatLagosTime, getCancellationDeadline } from '@/lib/timezone';
import Link from 'next/link';
import CancelBookingButton from './CancelBookingButton';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({ params }: PageProps) {
  const session = await auth();
  const user = session?.user as any;

  await requireAuth();

  const { id } = await params;
  const booking = await getBookingById(id);

  if (!booking) {
    redirect('/account');
  }

  // Check ownership
  if (booking.customerId !== user.id) {
    redirect('/account');
  }

  // Customers may cancel before the 1-hour cutoff (server re-validates on the action)
  const canCancel =
    (booking.status === 'pending' || booking.status === 'confirmed') &&
    new Date() < getCancellationDeadline({
      date: booking.appointmentDate,
      startTime: booking.startTime,
    });

  const serviceDetails = await Promise.all(
    (booking.services || []).map(async (service: any) => {
      const { getServiceWithImages } = await import('@/lib/pricing');
      return getServiceWithImages(service.serviceId);
    })
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/account"
          className="inline-block mb-6 text-burgundy hover:text-burgundy/80"
        >
          ← Back to My Bookings
        </Link>

        {/* Booking Status Banner */}
        <div className={`rounded-lg p-6 mb-6 ${
          booking.status === 'pending' ? 'bg-amber-50 border border-amber-200' :
          booking.status === 'confirmed' ? 'bg-green-50 border border-green-200' :
          booking.status === 'completed' ? 'bg-blue-50 border border-blue-200' :
          booking.status === 'cancelled' ? 'bg-red-50 border border-red-200' :
          booking.status === 'rejected' ? 'bg-gray-50 border border-gray-200' :
          'bg-gray-50 border border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Booking Details</h1>
              <p className="text-gray-600 mt-1">Reference: {booking.reference}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-lg font-semibold ${
              booking.status === 'pending' ? 'bg-amber-100 text-amber-800' :
              booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
              booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
              booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
              booking.status === 'rejected' ? 'bg-gray-100 text-gray-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {booking.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Appointment Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Appointment</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-medium">{formatLagosTime(new Date(booking.appointmentDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="font-medium">{booking.startTime} - {booking.endTime}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="font-medium">{formatLagosTime(new Date(booking.createdAt), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-medium capitalize">{booking.status.replace('_', ' ')}</p>
                </div>
              </div>
            </div>

            {/* Services */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Services</h2>
              <div className="space-y-4">
                {serviceDetails.map((service: any, index: number) => (
                  <div key={index} className="flex justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{service?.name || booking.services?.[index]?.serviceNameSnapshot}</p>
                      <p className="text-sm text-gray-600">{service?.description}</p>
                    </div>
                    <p className="font-medium">₦{(service?.price || booking.services?.[index]?.unitPriceSnapshot || 0) / 100}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {booking.customerNotes && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Your Notes</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{booking.customerNotes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Contact</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Name</p>
                  <p className="font-medium">{user?.name}</p>
                </div>
                <div>
                  <p className="text-gray-600">Email</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
                <div>
                  <p className="text-gray-600">Phone</p>
                  <p className="font-medium">{booking.phone}</p>
                </div>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Payment</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₦{(booking.subtotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Deposit Required</span>
                  <span className="font-medium">₦{(booking.depositRequired / 100).toFixed(2)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>₦{(booking.total / 100).toFixed(2)}</span>
                </div>
              </div>
              {booking.status === 'pending' && (
                <div className="mt-4 p-4 bg-burgundy/10 rounded-lg">
                  <p className="text-sm text-burgundy font-medium">Pending Admin Approval</p>
                  <p className="text-xs text-gray-600 mt-1">Your booking is pending approval. You'll receive a confirmation email once approved.</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {canCancel && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>
                <CancelBookingButton bookingId={booking.id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
