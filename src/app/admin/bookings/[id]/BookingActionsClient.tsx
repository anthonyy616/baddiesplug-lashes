'use client';

import { useState } from 'react';

interface BookingActionsClientProps {
  bookingId: string;
  status: string;
}

export default function BookingActionsClient({ bookingId, status }: BookingActionsClientProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setIsLoading(action);

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || 'Action failed');
      }
    } catch (error) {
      alert('Action failed');
    } finally {
      setIsLoading(null);
    }
  };

  const showActions = status === 'pending' || status === 'confirmed';

  if (!showActions) return null;

  return (
    <div className="space-y-3">
      {status === 'pending' && (
        <>
          <button
            onClick={() => handleAction('approve')}
            disabled={isLoading !== null}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading === 'approve' ? 'Approving...' : 'Approve Booking'}
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={isLoading !== null}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {isLoading === 'reject' ? 'Rejecting...' : 'Reject Booking'}
          </button>
        </>
      )}

      {status === 'confirmed' && (
        <>
          <button
            onClick={() => handleAction('complete')}
            disabled={isLoading !== null}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading === 'complete' ? '...' : 'Mark as Completed'}
          </button>
          <button
            onClick={() => handleAction('no_show')}
            disabled={isLoading !== null}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {isLoading === 'no_show' ? '...' : 'Mark as No Show'}
          </button>
          <button
            onClick={() => handleAction('cancel')}
            disabled={isLoading !== null}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading === 'cancel' ? '...' : 'Cancel Booking'}
          </button>
        </>
      )}
    </div>
  );
}
