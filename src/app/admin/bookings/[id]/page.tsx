import { getBookingById } from '@/lib/booking';
import { requireAdmin } from '@/lib/auth/types';
import { notFound } from 'next/navigation';
import { formatLagosTime } from '@/lib/timezone';
import { getServiceWithImages } from '@/lib/pricing';
import { db, bookings, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import BookingActionsClient from './BookingActionsClient';


interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminBookingDetailPage({ params }: PageProps) {
  await requireAdmin();

  const { id } = await params;
  const booking = await getBookingById(id);

  if (!booking) {
    notFound();
  }

  // Fetch the actual customer record (previously showed the admin's own session info)
  const customer = await db.query.users.findFirst({
    where: eq(users.id, booking.customerId),
  });

  // Fetch previous booking info if this is a rescheduled booking
  let previousBooking = null;
  if (booking.previousBookingId) {
    previousBooking = await db.query.bookings.findFirst({
      where: eq(bookings.id, booking.previousBookingId),
    });
  }

  // Get service details
  const serviceDetails = await Promise.all(
    (booking.services || []).map(async (service: any) => {
      return getServiceWithImages(service.serviceId);
    })
  );

  // Get addon details
  const addonDetails = await Promise.all(
    (booking.addons || []).map(async (addon: any) => {
      const { getAddonById } = await import('@/lib/pricing');
      return getAddonById(addon.addonId);
    })
  );

  // Get reference images
  const referenceImages = booking.referenceImages || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Booking Details</h1>
          <p className="text-gray-600 font-mono text-sm break-all">Reference: {booking.reference}</p>
        </div>
        <Link
          href="/admin/bookings"
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-center"
        >
          Back to Bookings
        </Link>
      </div>

      {/* Booking Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Status</h2>
              <span className={`px-3 py-1 text-sm rounded-full ${
                booking.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                booking.status === 'rejected' ? 'bg-gray-100 text-gray-800' :
                booking.status === 'no_show' ? 'bg-gray-100 text-gray-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {booking.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {booking.status === 'confirmed'
                ? 'Auto-approved. Mark as completed only after the appointment has finished.'
                : booking.status === 'completed'
                  ? 'Appointment completed.'
                  : 'Legacy booking status.'}
            </p>

            {previousBooking && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">Rescheduled from:</span>
                  {' '}
                  <Link
                    href={`/admin/bookings/${previousBooking.id}`}
                    className="text-burgundy hover:text-burgundy/80 font-mono"
                  >
                    {previousBooking.reference}
                  </Link>
                  {' '}
                  ({formatLagosTime(new Date(previousBooking.appointmentDate + 'T00:00:00'), 'MMM d, yyyy')} at {previousBooking.startTime})
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Created</p>
                <p className="font-medium">{formatLagosTime(new Date(booking.createdAt), 'MMM d, yyyy h:mm a')}</p>
              </div>
              <div>
                <p className="text-gray-600">Appointment</p>
                <p className="font-medium">{formatLagosTime(new Date(booking.appointmentDate + 'T00:00:00'), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-gray-600">Time</p>
                <p className="font-medium">{booking.startTime} - {booking.endTime}</p>
              </div>
              <div>
                <p className="text-gray-600">Updated</p>
                <p className="font-medium">{formatLagosTime(new Date(booking.updatedAt), 'MMM d, yyyy h:mm a')}</p>
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Services</h2>
            {serviceDetails.length === 0 ? (
              <p className="text-gray-500">No services selected</p>
            ) : (
              <div className="space-y-4">
                {serviceDetails.map((service: any, index: number) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{service?.name || booking.services?.[index]?.serviceNameSnapshot}</p>
                      <p className="text-sm text-gray-600">{service?.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">₦{(service?.price || booking.services?.[index]?.unitPriceSnapshot || 0) / 100}</p>
                      <p className="text-xs text-gray-500">Snapshot price</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add-ons */}
          {addonDetails.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Add-ons</h2>
              <div className="space-y-4">
                {addonDetails.map((addon: any, index: number) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{addon?.name || booking.addons?.[index]?.addonNameSnapshot}</p>
                      <p className="text-sm text-gray-600">{addon?.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">₦{(addon?.price || booking.addons?.[index]?.unitPriceSnapshot || 0) / 100}</p>
                      <p className="text-xs text-gray-500">Snapshot price</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reference Images */}
          {referenceImages.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Reference Images</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {referenceImages.map((image: any) => (
                  <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={`https://${process.env.R2_PUBLIC_URL?.replace('https://', '')}/${image.storageKey}`}
                      alt={image.originalFilename}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2">
                      {image.originalFilename}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {booking.customerNotes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Customer Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{booking.customerNotes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Customer</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">Name</p>
                <p className="font-medium">{customer?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-gray-600">Email</p>
                <p className="font-medium">{customer?.email || ''}</p>
              </div>
              <div>
                <p className="text-gray-600">Phone</p>
                <p className="font-medium">{booking.phone}</p>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Payment Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">₦{(booking.subtotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Deposit Required</span>
                <span className="font-medium">₦{(booking.depositRequired / 100).toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">₦{(booking.total / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Payments */}
            {(booking.payments?.length || 0) > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-medium text-gray-900 mb-3">Payments Recorded</h3>
                <div className="space-y-3">
                  {booking.payments?.map((payment: any) => (
                    <div key={payment.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{payment.paymentType}</p>
                          <p className="text-xs text-gray-500">{formatLagosTime(new Date(payment.createdAt), 'MMM d, h:mm a')}</p>
                        </div>
                        <p className="font-medium">₦{(payment.amount / 100).toFixed(2)}</p>
                      </div>
                      {payment.note && (
                        <p className="mt-2 text-sm text-gray-600">{payment.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-3">
              <BookingActionsClient bookingId={booking.id} status={booking.status} />
              <Link
                href={`/admin/customers/${booking.customerId}`}
                className="block w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-center"
              >
                View Customer
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


