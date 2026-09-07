'use client';

import { useState } from 'react';

interface CancelBookingButtonProps {
  bookingId: string;
}

export default function CancelBookingButton({ bookingId }: CancelBookingButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCancel = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/account/bookings/${bookingId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        window.location.href = '/account';
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to cancel booking');
      }
    } catch {
      alert('Failed to cancel booking');
    } finally {
      setIsLoading(false);
    }
  };

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        Cancel Booking
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Are you sure you want to cancel this booking? This action cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setShowConfirm(false)}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          No, Keep Booking
        </button>
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {isLoading ? 'Cancelling...' : 'Yes, Cancel Booking'}
        </button>
      </div>
    </div>
  );
}
