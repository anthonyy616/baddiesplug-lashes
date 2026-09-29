import { requireAdmin } from '@/lib/auth/types';
import { getActiveServices, getActiveAddons } from '@/lib/pricing';
import AdminCreateBookingForm from '@/components/admin/AdminCreateBookingForm';

export const dynamic = 'force-dynamic';

/**
 * Admin custom booking creation (Stage 2): create a booking for customers who
 * contacted the business outside the website flow (WhatsApp, walk-ins).
 */
export default async function AdminCreateBookingPage() {
  await requireAdmin();

  const [services, addons] = await Promise.all([
    getActiveServices(),
    getActiveAddons(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Create Booking</h1>
        <p className="text-gray-600">
          Create an appointment for a customer who contacted you outside the website
          (WhatsApp, walk-in, phone). Pricing and availability are validated server-side.
        </p>
      </div>

      <AdminCreateBookingForm
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          subcategory: s.subcategory,
          price: s.price,
          durationMinutes: s.durationMinutes,
        }))}
        addons={addons.map((a) => ({
          id: a.id,
          name: a.name,
          price: a.price,
        }))}
      />
    </div>
  );
}
