'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HomeMediaRow } from './HomepageMediaManager';

const ACCEPT =
  '.webp,.jpg,.jpeg,.png,.heic,.heif,image/webp,image/jpeg,image/png,image/heic,image/heif';

/**
 * Upload/replace/remove a single homepage image slot ('hero' | 'editorial').
 * Uploads go through the shared WebP pipeline; replaced images get a fresh R2
 * key so the CDN cache never serves a stale copy.
 */
export default function SlotUploader({
  slot,
  label,
  hint,
  initial,
}: {
  slot: 'hero' | 'editorial';
  label: string;
  hint: string;
  initial: HomeMediaRow | null;
}) {
  const router = useRouter();
  const [row, setRow] = useState<HomeMediaRow | null>(initial);
  const [alt, setAlt] = useState(initial?.altText ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append('slot', slot);
      fd.append('file', file);
      if (alt.trim()) fd.append('altText', alt.trim());

      const res = await fetch('/api/admin/home-media', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Upload failed');
        return;
      }
      setRow(data.media);
      setAlt(data.media?.altText ?? '');
      setNotice('Live on the homepage.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('Remove this image from the homepage? The photo is deleted from storage.')) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/home-media?slot=${slot}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Delete failed');
        return;
      }
      setRow(null);
      setAlt('');
      setNotice('Removed — the homepage shows the branded placeholder again.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const saveAlt = async () => {
    if (!row || alt.trim() === (row.altText ?? '')) return;
    setBusy(true);
    setError(null);
    try {
      // Alt-only edit: PATCH endpoint stores metadata without re-uploading bytes.
      const res = await fetch('/api/admin/home-media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, altText: alt.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save alt text');
        return;
      }
      setRow((prev) => (prev ? { ...prev, altText: alt.trim() } : prev));
      setNotice('Alt text saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="font-semibold text-gray-900">{label}</h2>
      <p className="text-xs text-gray-500 mt-0.5">{hint}</p>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
        <div className="aspect-[4/5] w-full max-w-[160px] overflow-hidden rounded-md bg-gray-100">
          {row ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.publicUrl} alt={row.altText || label} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0">
          {row && (
            <p className="mb-2 text-xs text-gray-500">
              {row.width}×{row.height}px · updated {new Date(row.updatedAt).toLocaleString()}
            </p>
          )}

          <label className="inline-flex cursor-pointer items-center rounded-lg bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50">
            <span>{busy ? 'Uploading…' : row ? 'Replace image' : 'Upload image'}</span>
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void upload(f);
              }}
            />
          </label>

          <div className="mt-3 flex max-w-md items-center gap-2">
            <input
              type="text"
              placeholder="Alt text (accessibility & SEO)"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              className="w-full rounded-md border border-black px-3 py-2 text-sm text-black"
            />
            {row && (
              <button
                type="button"
                onClick={saveAlt}
                disabled={busy || alt.trim() === (row.altText ?? '')}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Save
              </button>
            )}
          </div>

          {row && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="mt-3 block text-sm text-red-600 hover:text-red-800"
            >
              Remove image
            </button>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {notice && <p className="mt-2 text-sm text-green-700">{notice}</p>}
        </div>
      </div>
    </div>
  );
}
