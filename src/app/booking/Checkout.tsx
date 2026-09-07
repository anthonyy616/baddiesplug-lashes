'use client';

import { useState, useEffect } from 'react';

interface CheckoutProps {
  services: any[];
  addons: any[];
  date: string;
  slot: { startTime: string; endTime: string } | null;
  totalPrice: number;
  depositRequired: number;
  isAuthenticated: boolean;
  user: { name: string; email: string; phone?: string } | null;
  onSubmit: (data: { phone: string; notes?: string }) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
  loadingMessage: string;
}

export default function Checkout({
  services,
  addons,
  date,
  slot,
  totalPrice,
  depositRequired,
  isAuthenticated,
  user,
  onSubmit,
  onBack,
  isLoading,
  loadingMessage,
}: CheckoutProps) {
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string }>({});

  useEffect(() => {
    if (user?.phone) {
      setPhone(user.phone);
    }
  }, [user]);

  const formatPrice = (priceInKobo: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(priceInKobo / 100);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-NG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const validatePhone = (phone: string) => {
    const cleaned = phone.replace(/\s/g, '').replace(/[^+\d]/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!phone.trim()) {
      setErrors({ phone: 'Phone number is required' });
      return;
    }

    if (!validatePhone(phone)) {
      setErrors({ phone: 'Please enter a valid phone number (10-15 digits)' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ phone: phone.trim(), notes: notes.trim() || undefined });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!slot) return null;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Checkout</h3>

      {/* Booking Summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3">Booking Summary</h4>
        
        {/* Services */}
        <div className="mb-3">
          <p className="text-sm text-gray-600 mb-2">Services:</p>
          <ul className="text-sm space-y-1">
            {services.map(s => (
              <li key={s.id} className="flex justify-between">
                <span>{s.name}</span>
                <span className="font-medium">{formatPrice(s.price)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Addons */}
        {addons.length > 0 && (
          <div className="mb-3">
            <p className="text-sm text-gray-600 mb-2">Add-ons:</p>
            <ul className="text-sm space-y-1">
              {addons.map(a => (
                <li key={a.id} className="flex justify-between">
                  <span>{a.name}</span>
                  <span className="font-medium">{formatPrice(a.price)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Date & Time */}
        <div className="border-t pt-3 mt-3">
          <p className="text-sm text-gray-600 mb-2">Appointment:</p>
          <p className="font-medium">{formatDate(date)}</p>
          <p className="text-gray-600">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</p>
        </div>

        {/* Pricing */}
        <div className="border-t pt-3 mt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{formatPrice(totalPrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Deposit Required (50%)</span>
            <span className="font-medium text-burgundy">{formatPrice(depositRequired)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>Total</span>
            <span className="text-burgundy">{formatPrice(totalPrice)}</span>
          </div>
        </div>
      </div>

      {/* Booking Info Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number *
          </label>
          <input
            type="tel"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+234 xxx xxxx xxxx"
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy ${
              errors.phone ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.phone && (
            <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
          )}
          {isAuthenticated && (
            <p className="text-xs text-gray-500 mt-1">
              We'll use this to contact you about your appointment
            </p>
          )}
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Special Requests / Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any special requests or information you'd like us to know..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy resize-none"
          />
        </div>

        {/* Authentication notice */}
        {isAuthenticated ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            <p>✓ Signed in as <strong>{user?.name}</strong> ({user?.email})</p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <p>You'll be redirected to sign in to complete your booking.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-burgundy text-white font-semibold rounded-lg hover:bg-burgundy/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? loadingMessage : 'Confirm Booking'}
          </button>
        </div>
      </form>
    </div>
  );
}
