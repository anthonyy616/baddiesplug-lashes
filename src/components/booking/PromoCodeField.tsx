'use client';

import { useEffect, useState } from 'react';
import { formatNaira } from '@/lib/format/money';

/**
 * Promo/loyalty code field for the customer booking flow (Stage 10).
 *
 * UI GATING: rendered ONLY when GET /api/booking/promo-code reports the
 * signed-in customer has at least one usable code. If the admin deactivates,
 * revokes, expires, or exhausts every code, the next page load / focus shows
 * no field at all — customers never see a dead input.
 *
 * SECURITY: the browser sends ONLY the code string. The discount percent,
 * amount, final total, and deposit are computed SERVER-SIDE (preview) and
 * recomputed authoritatively inside the booking transaction. A client cannot
 * inject a discount.
 */

const ERROR_LABELS: Record<string, string> = {
  invalid_code: 'That code format doesn\u2019t look right.',
  not_found: 'We couldn\u2019t find that code.',
  ownership: 'That code isn\u2019t assigned to you.',
  inactive: 'That code is no longer active.',
  revoked: 'That code was revoked.',
  not_started: 'That code isn\u2019t active yet.',
  expired: 'That code has expired.',
  usage_limit: 'That code has no uses left.',
  service_mismatch: 'That code doesn\u2019t apply to the services in your cart.',
  zero_subtotal: 'Add a service before applying a code.',
  internal_error: 'Something went wrong. Please try again.',
};

export interface PromoPreview {
  code: string;
  discountPercent: number;
  discountAmount: number;
  finalTotal: number;
  deposit: number;
}

export default function PromoCodeField({
  serviceIds,
  onApplied,
  onCleared,
}: {
  serviceIds: string[];
  onApplied: (preview: PromoPreview) => void;
  onCleared: () => void;
}) {
  const [visible, setVisible] = useState<boolean | null>(null); // null = checking
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PromoPreview | null>(null);

  // Gate visibility: only fetch once; the component mounts when the review
  // step renders. hasUsableCodes=false → render nothing.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/booking/promo-code')
      .then((r) => r.json())
      .then((d: { hasUsableCodes?: boolean }) => {
        if (!cancelled) setVisible(Boolean(d.hasUsableCodes));
      })
      .catch(() => {
        if (!cancelled) setVisible(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function apply() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4 || applying) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch('/api/booking/promo-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed, serviceIds }),
      });
      const data = (await res.json()) as
        | ({ ok: true } & PromoPreview)
        | { ok: false; error: string };

      if (!res.ok || !data.ok) {
        const message =
          data && 'error' in data ? ERROR_LABELS[data.error] ?? 'That code can\u2019t be used.' : 'Something went wrong.';
        setError(message);
        setPreview(null);
        onCleared();
        return;
      }

      setPreview(data);
      onApplied(data);
    } catch {
      setError('Something went wrong. Please try again.');
      setPreview(null);
      onCleared();
    } finally {
      setApplying(false);
    }
  }

  function remove() {
    setPreview(null);
    setCode('');
    setError(null);
    onCleared();
  }

  if (visible === false) return null;
  if (visible === null) return null; // no layout jump while checking

  return (
    <section aria-label="Promo code" className="rounded-xl border border-line dark:border-line-dark p-4">
      {preview ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono font-semibold text-ink dark:text-ink-dark">{preview.code}</p>
            <p className="text-sm text-green-700 dark:text-green-400">
              {preview.discountPercent}% off — {formatNaira(preview.discountAmount)} off your booking
            </p>
          </div>
          <button
            type="button"
            onClick={remove}
            className="text-sm text-burgundy hover:text-burgundy/80"
          >
            Remove
          </button>
        </div>
      ) : (
        <>
          <label htmlFor="promo-code" className="block text-sm font-medium text-ink dark:text-ink-dark mb-2">
            Have a code?
          </label>
          <div className="flex gap-2">
            <input
              id="promo-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void apply())}
              placeholder="Enter code"
              maxLength={40}
              className="flex-1 px-3 py-2 border border-line dark:border-line-dark rounded-lg text-sm uppercase tracking-wide"
            />
            <button
              type="button"
              onClick={() => void apply()}
              disabled={code.trim().length < 4 || applying}
              className="px-4 py-2 bg-burgundy text-white rounded-lg text-sm hover:bg-burgundy/90 disabled:opacity-50"
            >
              {applying ? 'Checking…' : 'Apply'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
        </>
      )}
    </section>
  );
}
