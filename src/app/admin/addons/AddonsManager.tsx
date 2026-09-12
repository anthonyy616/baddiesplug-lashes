'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AddonRow {
  id: string;
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  displayOrder: number;
}

export default function AddonsManager({ initialAddons }: { initialAddons: AddonRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialAddons);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    priceNaira: '',
    displayOrder: '0',
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = await fetch('/api/admin/addons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        price: Math.round(parseFloat(form.priceNaira || '0') * 100),
        displayOrder: parseInt(form.displayOrder || '0', 10),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Failed to create add-on');
      return;
    }

    setItems((prev) => [...prev, data.addon]);
    setForm({ name: '', description: '', priceNaira: '', displayOrder: '0' });
    setShowForm(false);
    router.refresh();
  };

  const patch = async (id: string, updates: Record<string, unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/admin/addons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Update failed');
        return;
      }
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } as AddonRow : a)));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

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
          {showForm ? 'Cancel' : '+ Add Add-on'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            placeholder="Add-on name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 border border-black rounded-lg text-sm text-black"
            required
          />
          <input
            placeholder="Price in ₦"
            type="number"
            step="0.01"
            value={form.priceNaira}
            onChange={(e) => setForm({ ...form, priceNaira: e.target.value })}
            className="px-3 py-2 border border-black rounded-lg text-sm text-black"
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
            className="px-3 py-2 border border-black rounded-lg text-sm text-black md:col-span-2"
            required
          />
          <button type="submit" className="px-4 py-2 bg-burgundy text-white rounded-lg text-sm font-medium md:col-span-2">
            Create Add-on
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Add-on</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price (₦)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500 text-sm">No add-ons yet</td></tr>
            )}
            {items.map((a) => (
              <tr key={a.id} className={a.isActive ? '' : 'opacity-50'}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.description}</p>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    defaultValue={a.price / 100}
                    className="w-24 px-2 py-1 border border-black rounded text-sm text-black"
                    onBlur={(e) => {
                      const naira = parseFloat(e.target.value);
                      if (!Number.isNaN(naira) && naira * 100 !== a.price) {
                        patch(a.id, { price: Math.round(naira * 100) });
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => patch(a.id, { isActive: !a.isActive })}
                    disabled={busyId === a.id}
                    className={`px-2 py-1 text-xs rounded-full font-medium ${
                      a.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {a.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
