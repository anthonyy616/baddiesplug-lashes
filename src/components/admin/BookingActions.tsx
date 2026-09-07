'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Booking } from '@/types';

interface BookingActionsProps {
  booking: Booking;
}

export default function BookingActions({ booking }: BookingActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setIsLoading(action);

    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        router.refresh();
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

  const showActions = booking.status === 'pending' || booking.status === 'confirmed';

  if (!showActions) return null;

  return (
    <div className="flex gap-2">
      {booking.status === 'pending' && (
        <>
          <button
            onClick={() => handleAction('approve')}
            disabled={isLoading !== null}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading === 'approve' ? '...' : 'Approve'}
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={isLoading !== null}
            className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {isLoading === 'reject' ? '...' : 'Reject'}
          </button>
        </>
      )}

      {booking.status === 'confirmed' && (
        <>
          <button
            onClick={() => handleAction('complete')}
            disabled={isLoading !== null}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading === 'complete' ? '...' : 'Mark Complete'}
          </button>
          <button
            onClick={() => handleAction('no_show')}
            disabled={isLoading !== null}
            className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {isLoading === 'no_show' ? '...' : 'No Show'}
          </button>
          <button
            onClick={() => handleAction('cancel')}
            disabled={isLoading !== null}
            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading === 'cancel' ? '...' : 'Cancel'}
          </button>
        </>
      )}
    </div>
  );
}
