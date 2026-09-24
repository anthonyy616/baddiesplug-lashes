'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PaymentRow {
  id: string;
  bookingId: string;
  bookingReference: string;
  amount: number;
  paymentType: string;
  note?: string | null;
  createdAt: string;
}

interface BookingOption {
  id: string;
  reference: string;
  appointmentDate: string;
  startTime: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
}

export default function PaymentsManager({
  recentPayments,
  bookingOptions,
}: {
  recentPayments: PaymentRow[];
  bookingOptions: BookingOption[];
}) {
  const router = useRouter();
  const [payments, setPayments] = useState(recentPayments);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    bookingId: '',
    amountNaira: '',
    paymentType: 'deposit',
    note: '',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: form.bookingId.trim(),
          amount: Math.round(parseFloat(form.amountNaira || '0') * 100),
          paymentType: form.paymentType,
          note: form.note || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Failed to record payment');
        return;
      }

      setPayments((prev) => [
        {
          id: data.payment.id,
          bookingId: data.payment.bookingId,
          bookingReference: '(new)',
          amount: data.payment.amount,
          paymentType: data.payment.paymentType,
          note: data.payment.note,
          createdAt: 'Just now',
        },
        ...prev,
      ]);
      setSuccess('Payment recorded.');
      setForm({ bookingId: '', amountNaira: '', paymentType: 'deposit', note: '' });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>
      )}

      <form onSubmit={submit} className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Booking</label>
          <select
            value={form.bookingId}
            onChange={(e) => setForm({ ...form, bookingId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          >
            <option value="">Select a booking</option>
            {bookingOptions.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.reference} · {booking.customerName} · {booking.appointmentDate} {booking.startTime} · {booking.status}
                {booking.customerPhone ? ` · ${booking.customerPhone}` : ` · ${booking.customerEmail}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
          <input
            type="number"
            step="0.01"
            value={form.amountNaira}
            onChange={(e) => setForm({ ...form, amountNaira: e.target.value })}
            className="w-full px-3 py-2 border border-black rounded-lg text-sm text-black"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={form.paymentType}
            onChange={(e) => setForm({ ...form, paymentType: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="deposit">Deposit</option>
            <option value="balance">Balance</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="w-full px-3 py-2 border border-black rounded-lg text-sm text-black"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-4 py-2 bg-burgundy text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Record Payment'}
        </button>
      </form>

      {/* Mobile card list */}
      <div className="md:hidden">
        <h2 className="font-semibold text-gray-900 mb-3">Recent Payments</h2>
        <div className="space-y-3">
          {payments.length === 0 && (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">No payments recorded yet</div>
          )}
          {payments.map((p) => (
            <div key={p.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{p.bookingReference}</span>
                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 capitalize">{p.paymentType}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-600">{p.createdAt}</span>
                <span className="font-medium">₦{(p.amount / 100).toFixed(2)}</span>
              </div>
              {p.note && <p className="mt-2 text-sm text-gray-500">{p.note}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Recent Payments</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Booking</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">When</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500 text-sm">No payments recorded yet</td></tr>
            )}
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-sm">
                  <span className="font-mono">{p.bookingReference}</span>
                </td>
                <td className="px-4 py-3 text-sm font-medium">₦{(p.amount / 100).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 capitalize">
                    {p.paymentType}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.createdAt}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{p.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
