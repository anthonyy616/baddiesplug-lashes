'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatNairaCompact } from '@/lib/format/money';

/**
 * Customer favourites section (Stage 3).
 *
 * Lists the signed-in customer's favourite services (owned by them — the
 * server scopes every query to the session) with quick favourite/unfavourite
 * toggles and a link to book each service. Deactivated services are marked
 * and cannot be booked.
 */

interface FavouriteService {
  id: string;
  name: string;
  slug: string;
  category: string;
  subcategory?: string | null;
  price: number;
  isActive: boolean;
}

export default function FavouriteServices() {
  const [favourites, setFavourites] = useState<FavouriteService[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/account/favourites');
      if (res.ok) {
        const data = await res.json();
        setFavourites(data.favourites ?? []);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(serviceId: string) {
    setBusyId(serviceId);
    try {
      await fetch(`/api/account/favourites?serviceId=${serviceId}`, { method: 'DELETE' });
      setFavourites((prev) => prev.filter((f) => f.id !== serviceId));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Favourite Services
      </h2>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading favourites...</p>
      ) : favourites.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>You have no favourite services yet.</p>
          <Link
            href="/services"
            className="inline-block mt-3 text-burgundy hover:text-burgundy/80"
          >
            Browse services to add favourites →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {favourites.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{f.name}</p>
                  {!f.isActive && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      Unavailable
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatNairaCompact(f.price)} ·{' '}
                  {[f.category, f.subcategory].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {f.isActive && (
                  <Link
                    href={`/services/${f.slug}`}
                    className="px-3 py-1.5 bg-burgundy text-white text-sm rounded-lg hover:bg-burgundy/90 whitespace-nowrap"
                  >
                    Book
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  disabled={busyId === f.id}
                  className="text-sm text-gray-500 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Remove ${f.name} from favourites`}
                >
                  {busyId === f.id ? '...' : 'Remove'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
