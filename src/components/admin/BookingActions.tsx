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
  // Stage 5: optional customer-safe cancellation reason.
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelReason, setShowCancelReason] = useState(false);

  const handleAction = async (action: string, body: Record<string, string> = {}) => {
    setIsLoading(action);

    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...body }),
      });

      if (response.ok) {
        setCancelReason('');
        setShowCancelReason(false);
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

  /** Stage 5: first click reveals the reason panel; confirm inside it. */
  const handleCancelClick = () => {
    setShowCancelReason((v) => !v);
  };

  const showActions =
    booking.status === 'pending' ||
    booking.status === 'confirmed' ||
    booking.status === 'approved';

  if (!showActions) return null;

  return (
    <div className="flex gap-2 flex-wrap">
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
            onClick={() => handleAction('approve')}
            disabled={isLoading !== null}
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 disabled:opacity-50"
            title="Approve after reviewing payment proof"
          >
            {isLoading === 'approve' ? '...' : 'Approve Payment'}
          </button>
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
            className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-50"
            title="Manually mark as no-show"
          >
            {isLoading === 'no_show' ? '...' : 'No Show'}
          </button>
          <button
            onClick={handleCancelClick}
            disabled={isLoading !== null}
            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading === 'cancel' ? '...' : 'Cancel'}
          </button>
        </>
      )}

      {booking.status === 'approved' && (
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
            className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-50"
            title="Manually mark as no-show"
          >
            {isLoading === 'no_show' ? '...' : 'No Show'}
          </button>
          <button
            onClick={handleCancelClick}
            disabled={isLoading !== null}
            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading === 'cancel' ? '...' : 'Cancel'}
          </button>
        </>
      )}

      {showCancelReason && (
        <div className="w-full mt-2">
          <label
            htmlFor={`cancel-reason-${booking.id}`}
            className="block text-xs text-gray-600 mb-1"
          >
            Reason shown to the customer (optional)
          </label>
          <textarea
            id={`cancel-reason-${booking.id}`}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="e.g. Stylist unavailable at this time"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleAction('cancel', cancelReason.trim() ? { reason: cancelReason.trim() } : {})}
              disabled={isLoading !== null}
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading === 'cancel' ? '...' : 'Confirm Cancel'}
            </button>
            <button
              onClick={() => {
                setShowCancelReason(false);
                setCancelReason('');
              }}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
            >
              Keep Booking
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
