'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GalleryRow } from './HomepageMediaManager';

const ACCEPT =
  '.webp,.jpg,.jpeg,.png,.heic,.heif,image/webp,image/jpeg,image/png,image/heic,image/heif';

/**
 * Admin-managed homepage work gallery: multi-upload from any phone, captions,
 * one-click reorder, delete. The homepage renders the first 6 by displayOrder.
 */
export default function GalleryManager({ initialImages }: { initialImages: GalleryRow[] }) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFromServer = async () => {
    const res = await fetch('/api/admin/gallery');
    if (res.ok) {
      const data = await res.json();
      setImages(data.images || []);
    }
    router.refresh();
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/gallery', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(`${file.name}: ${data.error || 'upload failed'}`);
          continue;
        }
      }
      await refreshFromServer();
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, updates: Record<string, unknown>) => {
    const res = await fetch('/api/admin/gallery', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Update failed');
      return false;
    }
    setImages((prev) => prev.map((img) => (img.id === id ? ({ ...img, ...updates } as GalleryRow) : img)));
    return true;
  };

  const move = async (index: number, dir: -1 | 1) => {
    const a = images[index];
    const b = images[index + dir];
    if (!a || !b) return;
    setImages((prev) => {
      const next = [...prev];
      next[index] = b;
      next[index + dir] = a;
      return next;
    });
    // Persist the swapped orders.
    await Promise.all([
      fetch('/api/admin/gallery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, displayOrder: b.displayOrder }),
      }),
      fetch('/api/admin/gallery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, displayOrder: a.displayOrder }),
      }),
    ]);
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this image from the gallery? The photo is deleted from storage.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/gallery?id=${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Delete failed');
        return;
      }
      setImages((prev) => prev.filter((img) => img.id !== id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const ordinal = (i: number) => {
    const n = i + 1;
    const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
    return `${n}${suffix}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">Work Gallery</h2>
          <p className="text-xs text-gray-500">
            Shown on the homepage in this order — the first 6 fill the gallery grid; extras are reserves.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center rounded-lg bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50">
          <span>{busy ? 'Uploading…' : '+ Add gallery photos'}</span>
          <input
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {images.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No gallery photos yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <div key={img.id} className="overflow-hidden rounded-md border border-gray-200">
              <div className="aspect-[3/4] bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.publicUrl}
                  alt={img.altText || 'Gallery image'}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-2">
                <input
                  type="text"
                  placeholder="Caption (e.g. Mega Volume)"
                  defaultValue={img.caption ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (img.caption ?? '')) void patch(img.id, { caption: v });
                  }}
                  className="w-full rounded border border-black px-2 py-1 text-xs text-black"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">
                    {ordinal(i)} on homepage
                    {i >= 6 ? ' (reserve)' : ''}
                    {img.width && img.height ? ` · ${img.width}×${img.height}` : ''}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || busy}
                      className="rounded border px-1.5 text-sm hover:bg-gray-50 disabled:opacity-30"
                      aria-label="Move earlier"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === images.length - 1 || busy}
                      className="rounded border px-1.5 text-sm hover:bg-gray-50 disabled:opacity-30"
                      aria-label="Move later"
                    >
                      ↓
                      </button>
                    <button
                      onClick={() => remove(img.id)}
                      disabled={busy}
                      className="rounded border px-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-30"
                      aria-label="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
