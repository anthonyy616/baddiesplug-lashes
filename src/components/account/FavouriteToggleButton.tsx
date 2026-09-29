'use client';

import { useState } from 'react';

/**
 * Favourite/unfavourite toggle (Stage 3).
 *
 * Posts/deletes against the session-scoped favourites API. The parent page
 * passes whether the service is already favourited so the initial state is
 * correct on first paint; subsequent toggles are optimistic.
 */
export default function FavouriteToggleButton({
  serviceId,
  initialFavourited,
}: {
  serviceId: string;
  initialFavourited: boolean;
}) {
  const [favourited, setFavourited] = useState(initialFavourited);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !favourited;
    setFavourited(next); // optimistic
    try {
      if (next) {
        await fetch('/api/account/favourites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId }),
        });
      } else {
        await fetch(`/api/account/favourites?serviceId=${serviceId}`, {
          method: 'DELETE',
        });
      }
    } catch {
      setFavourited(!next); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favourited}
      aria-label={favourited ? 'Remove from favourites' : 'Add to favourites'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
        favourited
          ? 'border-burgundy text-burgundy bg-burgundy/5'
          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-burgundy hover:text-burgundy'
      } disabled:opacity-50`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={favourited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {favourited ? 'Favourited' : 'Favourite'}
    </button>
  );
}
