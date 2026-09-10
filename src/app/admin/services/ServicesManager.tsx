'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ServiceRow {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  durationMinutes: number;
  isActive: boolean;
  displayOrder: number;
}

const formatPrice = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(kobo / 100);

export default function ServicesManager({ initialServices }: { initialServices: ServiceRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialServices);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    name: '',
    category: 'lash',
    description: '',
    priceNaira: '',
    durationMinutes: '60',
    displayOrder: '0',
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = await fetch('/api/admin/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        category: form.category,
        description: form.description,
        price: Math.round(parseFloat(form.priceNaira || '0') * 100),
        durationMinutes: parseInt(form.durationMinutes || '60', 10),
        displayOrder: parseInt(form.displayOrder || '0', 10),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Failed to create service');
      return;
    }

    setItems((prev) => [...prev, data.service]);
    setForm({ name: '', category: 'lash', description: '', priceNaira: '', durationMinutes: '60', displayOrder: '0' });
    setShowForm(false);
    router.refresh();
  };

  const patch = async (id: string, updates: Record<string, unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/admin/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Update failed');
        return;
      }
      setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } as ServiceRow : s)));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Deactivate and hide this service? Historical bookings keep their records.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/services?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((s) => s.id !== id));
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  const move = async (service: ServiceRow, direction: -1 | 1) => {
    await patch(service.id, { displayOrder: service.displayOrder + direction });
  };

  const lash = items.filter((s) => s.category === 'lash');
  const brow = items.filter((s) => s.category === 'eyebrow');

  const renderTable = (title: string, list: ServiceRow[]) => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price (₦)</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {list.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500 text-sm">None yet</td></tr>
          )}
          {list.map((s) => (
            <tr key={s.id} className={s.isActive ? '' : 'opacity-50'}>
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-500 line-clamp-1">{s.description}</p>
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  defaultValue={s.price / 100}
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                  onBlur={(e) => {
                    const naira = parseFloat(e.target.value);
                    if (!Number.isNaN(naira) && naira * 100 !== s.price) {
                      patch(s.id, { price: Math.round(naira * 100) });
                    }
                  }}
                />
                <p className="text-[10px] text-gray-400 mt-0.5">{formatPrice(s.price)}</p>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{s.durationMinutes} min</td>
              <td className="px-4 py-3">
                <button
                  onClick={() => patch(s.id, { isActive: !s.isActive })}
                  disabled={busyId === s.id}
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    s.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {s.isActive ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button onClick={() => move(s, -1)} className="px-1.5 border rounded text-sm hover:bg-gray-50">↑</button>
                  <button onClick={() => move(s, 1)} className="px-1.5 border rounded text-sm hover:bg-gray-50">↓</button>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => remove(s.id)}
                  disabled={busyId === s.id}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-burgundy text-white rounded-lg hover:bg-burgundy/90 text-sm font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Service'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            placeholder="Service name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="lash">Lash</option>
            <option value="eyebrow">Eyebrow</option>
          </select>
          <input
            placeholder="Price in ₦ (e.g. 35000)"
            type="number"
            step="0.01"
            value={form.priceNaira}
            onChange={(e) => setForm({ ...form, priceNaira: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          />
          <input
            placeholder="Duration (minutes, max 120)"
            type="number"
            min={5}
            max={120}
            value={form.durationMinutes}
            onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          />
          <input
            placeholder="Display order"
            type="number"
            value={form.displayOrder}
            onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm md:col-span-2"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 bg-burgundy text-white rounded-lg text-sm font-medium md:col-span-2"
          >
            Create Service
          </button>
        </form>
      )}

      {renderTable('Lash Services', lash)}
      {renderTable('Eyebrow Services', brow)}
    </div>
  );
}
