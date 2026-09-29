'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatNaira } from '@/lib/format/money';

/**
 * Admin Create Booking form (Stage 2).
 *
 * Flow: search & select an existing customer -> pick services + add-ons ->
 * pick a date and an available slot -> review the server-derived price
 * preview -> confirm creation.
 *
 * The displayed price preview is indicative only; the server recalculates all
 * pricing from the catalogue at creation time. Slot availability comes from
 * the same authoritative availability API the customer flow uses.
 */

interface ServiceOption {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  price: number;
  durationMinutes: number;
}

interface AddonOption {
  id: string;
  name: string;
  price: number;
}

interface CustomerOption {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

interface SlotOption {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  reason?: string;
}

const REASON_LABELS: Record<string, string> = {
  booked: 'Booked',
  blocked: 'Blocked',
  closed: 'Closed',
  outside_booking_window: 'Outside booking window',
  too_soon: 'Too soon',
};

export default function AdminCreateBookingForm({
  services,
  addons,
}: {
  services: ServiceOption[];
  addons: AddonOption[];
}) {
  const router = useRouter();

  // Customer search & selection
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);

  // Selections
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Slot
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<SlotOption | null>(null);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Indicative catalogue preview (server recalculates authoritatively)
  const preview = useMemo(() => {
    const serviceTotal = services
      .filter((s) => selectedServiceIds.includes(s.id))
      .reduce((sum, s) => sum + s.price, 0);
    const addonTotal = addons
      .filter((a) => selectedAddonIds.includes(a.id))
      .reduce((sum, a) => sum + a.price, 0);
    const subtotal = serviceTotal + addonTotal;
    return { subtotal, deposit: Math.max(Math.round(subtotal * 0.5), 500000) };
  }, [services, addons, selectedServiceIds, selectedAddonIds]);

  async function searchCustomers() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/bookings/create?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(data.customers ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectCustomer(c: CustomerOption) {
    setCustomer(c);
    if (c.phone) setPhone(c.phone);
    setResults([]);
    setQuery('');
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAddon(id: string) {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function loadSlots(d: string) {
    setSlot(null);
    setSlots([]);
    if (!d) return;
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/availability?date=${d}`);
      const data = await res.json();
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  const canSubmit =
    Boolean(customer) &&
    selectedServiceIds.length > 0 &&
    Boolean(date) &&
    Boolean(slot) &&
    phone.trim().length >= 10 &&
    !submitting;

  async function submit() {
    if (!customer || !slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          serviceIds: selectedServiceIds,
          addonIds: selectedAddonIds,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          phone: phone.trim(),
          customerNotes: customerNotes.trim() || undefined,
          adminNotes: adminNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push(`/admin/bookings/${data.bookingId}`);
      } else {
        setError(data.error === 'slot_not_available'
          ? 'That slot is no longer available. Pick another slot.'
          : data.error || 'Failed to create booking');
      }
    } catch {
      setError('Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1 — Customer */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold text-gray-900 mb-1">1. Customer</h2>
        <p className="text-sm text-gray-600 mb-4">Search existing customers by name, email, or phone.</p>

        {customer ? (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">{customer.name}</p>
              <p className="text-sm text-gray-600">{customer.email}{customer.phone ? ` · ${customer.phone}` : ''}</p>
            </div>
            <button
              type="button"
              onClick={() => setCustomer(null)}
              className="text-sm text-burgundy hover:text-burgundy/80"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchCustomers())}
                placeholder="Search customers..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={searchCustomers}
                disabled={query.trim().length < 2 || searching}
                className="px-4 py-2 bg-burgundy text-white rounded-lg text-sm hover:bg-burgundy/90 disabled:opacity-50"
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>
            {results.length > 0 && (
              <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50"
                    >
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-sm text-gray-600">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Step 2 — Services & add-ons */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold text-gray-900 mb-4">2. Services & Add-ons</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {services.map((s) => (
            <label
              key={s.id}
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${
                selectedServiceIds.includes(s.id)
                  ? 'border-burgundy bg-burgundy/5'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedServiceIds.includes(s.id)}
                  onChange={() => toggleService(s.id)}
                  className="accent-burgundy"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{s.name}</span>
                  <span className="block text-xs text-gray-500 capitalize">
                    {[s.category, s.subcategory].filter(Boolean).join(' · ')} · {s.durationMinutes} min
                  </span>
                </span>
              </span>
              <span className="text-sm text-gray-900">{formatNaira(s.price)}</span>
            </label>
          ))}
        </div>

        {addons.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {addons.map((a) => (
              <label
                key={a.id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${
                  selectedAddonIds.includes(a.id)
                    ? 'border-burgundy bg-burgundy/5'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedAddonIds.includes(a.id)}
                    onChange={() => toggleAddon(a.id)}
                    className="accent-burgundy"
                  />
                  <span className="text-sm font-medium text-gray-900">{a.name}</span>
                </span>
                <span className="text-sm text-gray-900">{formatNaira(a.price)}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Step 3 — Date & slot */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold text-gray-900 mb-4">3. Date & Time</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                loadSlots(e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Phone (for this booking)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Customer phone"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {loadingSlots && <p className="text-sm text-gray-500">Loading slots...</p>}
        {!loadingSlots && date && slots.length === 0 && (
          <p className="text-sm text-gray-500">No slots for this date (closed day).</p>
        )}
        {slots.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {slots.map((s) => (
              <button
                key={`${s.startTime}-${s.endTime}`}
                type="button"
                disabled={!s.available}
                onClick={() => setSlot(s)}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  slot?.startTime === s.startTime
                    ? 'bg-burgundy text-white border-burgundy'
                    : s.available
                      ? 'border-gray-200 hover:bg-gray-50 text-gray-900'
                      : 'border-gray-100 bg-gray-50 text-gray-400 line-through cursor-not-allowed'
                }`}
                title={s.reason ? REASON_LABELS[s.reason] || s.reason : undefined}
              >
                {s.startTime}–{s.endTime}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Step 4 — Notes & review */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold text-gray-900 mb-4">4. Notes & Review</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Customer notes (visible to customer)</label>
            <textarea
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Internal admin notes (never shown to customer)</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Catalogue subtotal (preview)</span>
            <span className="font-medium text-gray-900">{formatNaira(preview.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Deposit (preview)</span>
            <span className="font-medium text-gray-900">{formatNaira(preview.deposit)}</span>
          </div>
          <p className="text-xs text-gray-500 pt-1">
            Final pricing is recalculated from the catalogue by the server when the booking is created.
          </p>
        </div>

        {error && (
          <p className="mt-4 px-4 py-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="mt-4 w-full sm:w-auto px-6 py-2.5 bg-burgundy text-white rounded-lg hover:bg-burgundy/90 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Booking'}
        </button>
      </section>
    </div>
  );
}
