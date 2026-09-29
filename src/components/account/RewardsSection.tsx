import { getCustomerCodes } from '@/lib/loyalty';

/**
 * Customer "My Rewards" section (Stage 10) — READ-ONLY view of codes the
 * customer can use at booking time: loyalty codes assigned to them plus
 * general promo codes. Codes are applied in the booking flow; the discount
 * is always validated server-side there.
 */

function statusOf(code: {
  isActive: boolean;
  revokedAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  usageCount: number;
}): { label: string; cls: string } {
  if (code.revokedAt) return { label: 'Revoked', cls: 'bg-red-100 text-red-800' };
  if (!code.isActive) return { label: 'Inactive', cls: 'bg-gray-100 text-gray-800' };
  if (code.expiresAt && new Date() > code.expiresAt)
    return { label: 'Expired', cls: 'bg-gray-100 text-gray-800' };
  if (code.usageLimit !== null && code.usageCount >= code.usageLimit)
    return { label: 'Fully used', cls: 'bg-amber-100 text-amber-800' };
  return { label: 'Available', cls: 'bg-green-100 text-green-800' };
}

export default async function RewardsSection({ customerId }: { customerId: string }) {
  const codes = await getCustomerCodes(customerId);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">My Rewards</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Enter one of these codes during checkout — the discount is applied to your booking total
        before the deposit is calculated.
      </p>

      {codes.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No rewards yet — check back after your next visit.
        </p>
      ) : (
        <div className="space-y-3">
          {codes.map((code) => {
            const status = statusOf(code);
            const remaining =
              code.usageLimit === null ? null : Math.max(0, code.usageLimit - code.usageCount);
            return (
              <div
                key={code.id}
                className="flex flex-wrap items-center gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {code.code}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${status.cls}`}>
                  {status.label}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {code.discountPercent}% off{code.codeType === 'loyalty' ? ' (loyalty reward)' : ''}
                </span>
                {remaining !== null && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {remaining} use{remaining === 1 ? '' : 's'} remaining
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                  {code.expiresAt
                    ? `Valid until ${new Date(code.expiresAt).toLocaleDateString()}`
                    : 'No expiry'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
