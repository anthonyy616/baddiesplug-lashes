'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BeforeAfterEntry } from '@/types';

/**
 * Admin manager for the before/after client gallery (Stage 6): upload pairs,
 * assign service/booking, caption, consent + publication control, reorder,
 * delete. Uploads never auto-publish.
 */
interface ServiceOption {
  id: string;
  name: string;
  category: string;
}

interface BookingOption {
  id: string;
  reference: string;
  appointmentDate: string;
  startTime: string;
  customerName: string;
  customerEmail: string;
  serviceNames: string[];
}

export default function BeforeAfterManager({
  initialEntries,
  services,
  bookings,
}: {
  initialEntries: BeforeAfterEntry[];
  services: ServiceOption[];
  bookings: BookingOption[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [altText, setAltText] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [clientConsent, setClientConsent] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  async function refresh() {
    const res = await fetch('/api/admin/before-after', { cache: 'no-store' });
      if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
    }
    router.refresh();
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!beforeFile || !afterFile) {
      setError('Both a before and an after image are required.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set('beforeFile', beforeFile);
      form.set('afterFile', afterFile);
      if (caption.trim()) form.set('caption', caption.trim());
      if (altText.trim()) form.set('altText', altText.trim());
      if (serviceId) form.set('serviceId', serviceId);
      if (bookingId.trim()) form.set('bookingId', bookingId.trim());
      form.set('clientConsent', clientConsent ? 'true' : 'false');
      form.set('isPublic', isPublic ? 'true' : 'false');

      const res = await fetch('/api/admin/before-after', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed');
        return;
      }
      setMessage(clientConsent && isPublic
        ? 'Uploaded and published.'
        : 'Uploaded as a draft — publish it once client consent is recorded.');
      setBeforeFile(null);
      setAfterFile(null);
      setCaption('');
      setAltText('');
      setServiceId('');
      setBookingId('');
      setClientConsent(false);
      setIsPublic(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/before-after', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Update failed');
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this before/after entry and both images? This cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/before-after?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Delete failed');
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function move(entry: BeforeAfterEntry, direction: -1 | 1) {
    const sorted = [...entries].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex((e) => e.id === entry.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    patch(entry.id, { displayOrder: swapWith.displayOrder });
    patch(swapWith.id, { displayOrder: entry.displayOrder });
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>
      )}
      {message && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{message}</div>
      )}

      {/* Upload */}
      <form onSubmit={handleUpload} className="bg-white rounded-lg shadow p-6 space-y-4 max-w-2xl">
        <h2 className="font-semibold text-gray-900">Upload a before/after pair</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">Before image *</span>
            <input
              type="file"
              accept="image/webp,image/jpeg,image/png,image/heic,image/heif"
              onChange={(e) => setBeforeFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">After image *</span>
            <input
              type="file"
              accept="image/webp,image/jpeg,image/png,image/heic,image/heif"
              onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
              required
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-sm text-gray-600 mb-1">Caption</span>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={120}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="e.g. Classic set — 6 week fill"
          />
        </label>
        <label className="block">
          <span className="block text-sm text-gray-600 mb-1">Alt text</span>
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            maxLength={255}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="Accessibility description"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">Service</span>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">No service assigned</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.category} · {service.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">Completed booking ID</span>
            <select
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">No booking assigned</option>
              {bookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.reference} · {booking.appointmentDate} · {booking.customerName}
                  {booking.serviceNames.length > 0 ? ` · ${booking.serviceNames.join(', ')}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={clientConsent}
              onChange={(e) => setClientConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-gray-700">
              <strong>Client consent recorded</strong> — the client agreed to publication of these images.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="mt-0.5"
              disabled={!clientConsent}
            />
            <span className="text-gray-700">
              Publish to the public gallery (requires consent). Leave unchecked to save as a draft.
            </span>
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-burgundy text-white rounded-lg hover:bg-burgundy/90 disabled:opacity-50 text-sm"
        >
          {busy ? 'Uploading…' : 'Upload pair'}
        </button>
      </form>

      {/* Entries */}
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-900">Entries ({entries.length})</h2>
        {entries.length === 0 && (
          <p className="text-sm text-gray-500">No before/after entries yet.</p>
        )}
        {[...entries]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((entry) => (
            <div key={entry.id} className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row gap-4">
              <div className="flex gap-2 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.beforePublicUrl}
                  alt={entry.altText ? `${entry.altText} (before)` : 'Before'}
                  className="w-28 h-28 object-cover rounded-md border border-gray-200"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.afterPublicUrl}
                  alt={entry.altText ? `${entry.altText} (after)` : 'After'}
                  className="w-28 h-28 object-cover rounded-md border border-gray-200"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      entry.isPublic
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {entry.isPublic ? 'Published' : 'Draft'}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      entry.clientConsent
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {entry.clientConsent ? 'Consent recorded' : 'No consent'}
                  </span>
                  {entry.bookingId && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700 font-mono">
                      booking linked
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-900 mt-2">{entry.caption || <span className="text-gray-400">No caption</span>}</p>
                <p className="text-xs text-gray-500 font-mono break-all mt-1">Order: {entry.displayOrder}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => patch(entry.id, { clientConsent: !entry.clientConsent })}
                    disabled={busy}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-md hover:bg-gray-200 disabled:opacity-50"
                  >
                    {entry.clientConsent ? 'Revoke consent' : 'Record consent'}
                  </button>
                  <button
                    onClick={() => patch(entry.id, { isPublic: !entry.isPublic })}
                    disabled={busy || (!entry.clientConsent && !entry.isPublic)}
                    title={!entry.clientConsent ? 'Recording client consent is required before publishing' : undefined}
                    className="px-3 py-1.5 bg-burgundy text-white text-xs rounded-md hover:bg-burgundy/90 disabled:opacity-40"
                  >
                    {entry.isPublic ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => move(entry, -1)}
                    disabled={busy}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-md hover:bg-gray-200 disabled:opacity-50"
                  >
                    ↑ Move up
                  </button>
                  <button
                    onClick={() => move(entry, 1)}
                    disabled={busy}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-md hover:bg-gray-200 disabled:opacity-50"
                  >
                    ↓ Move down
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={busy}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
