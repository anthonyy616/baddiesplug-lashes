import { requireAdminSession } from '@/lib/admin-auth';
import LoyaltyManager from './LoyaltyManager';

export const dynamic = 'force-dynamic';

export default async function AdminLoyaltyPage() {
  await requireAdminSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Loyalty &amp; Promo Codes</h1>
        <p className="text-gray-600 mt-1">
          Customer-specific loyalty rewards and general promo codes. Discounts are validated and
          applied <strong>server-side only</strong> at booking time — the browser never decides an
          amount.
        </p>
      </div>
      <LoyaltyManager />
    </div>
  );
}
