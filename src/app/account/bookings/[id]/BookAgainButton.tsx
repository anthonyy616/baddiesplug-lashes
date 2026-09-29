'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * BOOK AGAIN (Stage 3).
 *
 * Convenience, not duplication: clicking verifies the past booking's services
 * against the current catalogue via the Book Again endpoint, then opens the
 * NORMAL booking flow with pre-selections. The customer must still choose a
 * new date/time, and the server recalculates pricing and re-validates
 * availability — no booking is created by this action.
 */
export default function BookAgainButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function bookAgain() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/bookings/${bookingId}/book-again`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error === 'Unauthorized'
          ? 'You can only rebook your own appointments.'
          : data.error || 'Could not prepare rebooking.');
        setLoading(false);
        return;
      }

      // The booking flow applies the pre-selections from ?bookAgain= and
      // forces a fresh date/time + normal server validation.
      router.push(`/booking?bookAgain=${bookingId}`);
    } catch {
      setError('Could not prepare rebooking. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={bookAgain}
        disabled={loading}
        className="w-full px-4 py-2.5 bg-burgundy text-white rounded-lg hover:bg-burgundy/90 disabled:opacity-50"
      >
        {loading ? 'Preparing...' : 'Book Again'}
      </button>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Pre-fills the same services — you choose a new date and time, and current prices apply.
      </p>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
