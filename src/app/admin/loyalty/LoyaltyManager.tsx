'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Loyalty + promo code manager (Stage 10). Admin creates codes, inspects
 * usage, and activates/deactivates/revokes them. Redemption records are
 * visible per code for auditing.
 */

interface LoyaltyCode {
  id: string;
  code: string;
  codeType: 'loyalty' | 'promo';
  customerId: string | null;
  discountPercent: number;
  applicableServiceIds: string[] | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  revokedAt: string | null;
  note: string | null;
  redemptions: number;
}

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface Redemption {
  id: string;
  bookingId: string;
  discountAmount: number;
  redeemedAt: string;
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-burgundy/40';

export default function LoyaltyManager() {
  const [codes, setCodes] = useState<LoyaltyCode[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  // Create form
  const [code, setCode] = useState('');
  const [codeType, setCodeType] = useState<'loyalty' | 'promo'>('loyalty');
  const [customerId, setCustomerId] = useState('');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [usageLimit, setUsageLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/loyalty');
      if (!res.ok) throw new Error('Failed to load codes');
      const data = (await res.json()) as { codes: LoyaltyCode[]; customers: Customer[] };
      setCodes(data.codes);
      setCustomers(data.customers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createCode = async () => {
    setError(null);
    setMessage(null);
    const percent = Number(discountPercent);
    if (!code.trim() || !Number.isInteger(percent) || percent < 1 || percent > 100) {
      setError('Enter a code and a discount percent between 1 and 100.');
      return;
    }
    try {
      const res = await fetch('/api/admin/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          codeType,
          customerId: codeType === 'loyalty' ? customerId : null,
          discountPercent: percent,
          usageLimit: usageLimit.trim() ? Number(usageLimit) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          note: note.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setMessage(`Code ${code.trim().toUpperCase()} created.`);
      setCode('');
      setDiscountPercent('10');
      setUsageLimit('');
      setExpiresAt('');
      setNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  };

  const patch = async (body: { id: string; isActive?: boolean; revoke?: boolean }) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/loyalty', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Update failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const remove = async (entry: LoyaltyCode) => {
    if (!window.confirm(`Delete ${entry.code}? Its usage history will also be removed. This cannot be undone.`)) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/loyalty?id=${entry.id}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setMessage(`Code ${entry.code} deleted.`);
      if (expanded === entry.id) setExpanded(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const toggleRedemptions = async (codeId: string) => {
    if (expanded === codeId) {
      setExpanded(null);
      return;
    }
    setExpanded(codeId);
    setRedemptions([]);
    try {
      const res = await fetch(`/api/admin/loyalty?redemptionsFor=${codeId}`);
      const data = (await res.json()) as { redemptions: Redemption[] };
      setRedemptions(data.redemptions ?? []);
    } catch {
      setRedemptions([]);
    }
  };

  const statusOf = (c: LoyaltyCode) => {
    if (c.revokedAt) return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">Revoked</span>;
    if (!c.isActive) return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">Inactive</span>;
    if (c.usageLimit !== null && c.usageCount >= c.usageLimit)
      return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800">Exhausted</span>;
    return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">Active</span>;
  };

  return (
    <div className="space-y-6">
      {/* Create */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create code</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
            <input
              className={inputCls}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="GLOW20"
              maxLength={40}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              className={inputCls}
              value={codeType}
              onChange={(e) => setCodeType(e.target.value as 'loyalty' | 'promo')}
            >
              <option value="loyalty">Loyalty (one customer)</option>
              <option value="promo">Promo (everyone)</option>
            </select>
          </div>
          {codeType === 'loyalty' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer</label>
              <select
                className={inputCls}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Discount %</label>
            <input
              className={inputCls}
              type="number"
              min={1}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Usage limit (blank = unlimited)</label>
            <input
              className={inputCls}
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Expires at (optional)</label>
            <input
              className={inputCls}
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
            <input
              className={inputCls}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={255}
              placeholder="e.g. birthday reward 2026"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={createCode}
          className="mt-4 px-4 py-2 bg-burgundy text-white rounded-lg hover:bg-burgundy/90 text-sm"
        >
          Create code
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{message}</div>
      )}

      {/* List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Codes</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-gray-500">No codes yet.</p>
        ) : (
          <div className="space-y-3">
            {codes.map((c) => (
              <div key={c.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono font-semibold text-gray-900">{c.code}</span>
                  {statusOf(c)}
                  <span className="px-2 py-0.5 text-xs rounded-full bg-burgundy/10 text-burgundy">
                    {c.codeType === 'loyalty' ? 'Loyalty' : 'Promo'}
                  </span>
                  <span className="text-sm text-gray-700">{c.discountPercent}% off</span>
                  <span className="text-sm text-gray-500">
                    {c.usageLimit === null ? `${c.usageCount} uses` : `${c.usageCount}/${c.usageLimit} uses`}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {c.expiresAt ? `Expires ${new Date(c.expiresAt).toLocaleDateString()}` : 'No expiry'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => patch({ id: c.id, isActive: !c.isActive })}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {c.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  {!c.revokedAt && (
                    <button
                      type="button"
                      onClick={() => patch({ id: c.id, revoke: true })}
                      className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Revoke
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRedemptions(c.id)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {expanded === c.id ? 'Hide usage' : `Usage (${c.redemptions})`}
                  </button>
                </div>
                {expanded === c.id && (
                  <div className="mt-3 text-xs text-gray-600">
                    {redemptions.length === 0 ? (
                      <p>No redemptions yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {redemptions.map((r) => (
                          <li key={r.id}>
                            Booking{' '}
                            <a className="text-burgundy underline" href={`/admin/bookings/${r.bookingId}`}>
                              {r.bookingId.slice(0, 8)}…
                            </a>{' '}
                            — ₦{(r.discountAmount / 100).toFixed(2)} off —{' '}
                            {new Date(r.redeemedAt).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {c.note && <p className="text-xs text-gray-500 mt-2">Note: {c.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
