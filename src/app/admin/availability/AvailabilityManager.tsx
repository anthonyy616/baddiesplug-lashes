'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Override {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: string;
  reason?: string | null;
}

const STANDARD_SLOTS = [
  { startTime: '09:00', endTime: '11:00', label: '9:00 – 11:00 AM' },
  { startTime: '12:00', endTime: '14:00', label: '12:00 – 2:00 PM' },
  { startTime: '14:00', endTime: '16:00', label: '2:00 – 4:00 PM' },
  { startTime: '16:00', endTime: '18:00', label: '4:00 – 6:00 PM' },
];

export default function AvailabilityManager({
  date: initialDate,
  overrides: initialOverrides,
}: {
  date: string;
  overrides: Override[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [overrides, setOverrides] = useState(initialOverrides);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDate = async (newDate: string) => {
    setDate(newDate);
    setError(null);
    const res = await fetch(`/api/admin/availability?date=${newDate}`);
    const data = await res.json().catch(() => ({}));
    setOverrides(data.overrides || []);
    // Refresh server components for booking info
    router.replace(`/admin/availability?date=${newDate}`);
  };

  const saveOverride = async (slot: (typeof STANDARD_SLOTS)[number], mode: 'available' | 'blocked') => {
    setBusy(slot.startTime);
    setError(null);
    try {
      const res = await fetch('/api/admin/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          mode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to save override');
        return;
      }
      setOverrides((prev) => {
        const rest = prev.filter((o) => !(o.startTime === slot.startTime && o.endTime === slot.endTime));
        return [...rest, data.override];
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const removeOverride = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/availability?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setOverrides((prev) => prev.filter((o) => o.id !== id));
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row sm:items-end gap-4">
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => loadDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <p className="text-sm text-gray-500">
          Overrides apply to this date only. Blocking hides the slot from customers; opening makes a
          normally closed day bookable.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {STANDARD_SLOTS.map((slot) => {
          const override = overrides.find(
            (o) => o.startTime === slot.startTime && o.endTime === slot.endTime
          );

          return (
            <div key={slot.startTime} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-gray-900">{slot.label}</p>
                {override ? (
                  <span
                    className={`px-2 py-1 text-xs rounded-full font-medium ${
                      override.mode === 'blocked'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {override.mode === 'blocked' ? 'Blocked' : 'Forced open'}
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs rounded-full font-medium bg-gray-100 text-gray-600">
                    Standard
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => saveOverride(slot, 'blocked')}
                  disabled={busy !== null || override?.mode === 'blocked'}
                  className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-40"
                >
                  Block
                </button>
                <button
                  onClick={() => saveOverride(slot, 'available')}
                  disabled={busy !== null || override?.mode === 'available'}
                  className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-40"
                >
                  Open
                </button>
                {override && (
                  <button
                    onClick={() => removeOverride(override.id)}
                    disabled={busy !== null}
                    className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
