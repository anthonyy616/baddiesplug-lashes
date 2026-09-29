'use client';

import { useState } from 'react';

interface BookingActionsClientProps {
  bookingId: string;
  status: string;
}

export default function BookingActionsClient({ bookingId, status }: BookingActionsClientProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');
  // Stage 5: optional customer-safe cancellation reason.
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const handleAction = async (action: string, body: Record<string, string> = {}) => {
    setIsLoading(action);

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...body }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.newBookingId) {
          window.location.href = `/admin/bookings/${data.newBookingId}`;
        } else {
          window.location.reload();
        }
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

  const showActions =
    status === 'pending' || status === 'confirmed' || status === 'approved';

  if (!showActions) return null;

  /** Stage 5: first click reveals the reason panel; confirm inside it. */
  const handleCancelClick = () => {
    setShowCancelReason((v) => !v);
  };

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
            onClick={() => handleAction('approve')}
            disabled={isLoading !== null}
            className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            title="Approve after reviewing payment proof"
          >
            {isLoading === 'approve' ? 'Approving...' : 'Approve Payment'}
          </button>
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
            className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            title="Manually mark as no-show"
          >
            {isLoading === 'no_show' ? '...' : 'Mark as No Show'}
          </button>
          <button
            onClick={handleCancelClick}
            disabled={isLoading !== null}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading === 'cancel' ? '...' : 'Cancel Booking'}
          </button>
        </>
      )}

      {status === 'approved' && (
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
            className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            title="Manually mark as no-show"
          >
            {isLoading === 'no_show' ? '...' : 'Mark as No Show'}
          </button>
          <button
            onClick={handleCancelClick}
            disabled={isLoading !== null}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading === 'cancel' ? '...' : 'Cancel Booking'}
          </button>
        </>
      )}

      {showCancelReason && (
        <div className="p-4 bg-red-50 rounded-lg space-y-2">
          <label
            htmlFor="cancel-reason"
            className="block text-xs text-gray-700"
          >
            Reason shown to the customer (optional)
          </label>
          <textarea
            id="cancel-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="e.g. Stylist unavailable at this time"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-burgundy"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('cancel', cancelReason.trim() ? { reason: cancelReason.trim() } : {})}
              disabled={isLoading !== null}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading === 'cancel' ? '...' : 'Confirm Cancel'}
            </button>
            <button
              onClick={() => {
                setShowCancelReason(false);
                setCancelReason('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
            >
              Keep Booking
            </button>
          </div>
        </div>
      )}

      {(status === 'confirmed' || status === 'approved') && (
        <div className="border-t pt-4 mt-4">
          <button
            onClick={() => setShowReschedule(!showReschedule)}
            className="flex items-center gap-2 text-sm text-burgundy hover:text-burgundy/80 w-full justify-start"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reschedule
          </button>
          {showReschedule && (
            <div className="mt-3 space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 border border-black rounded-lg text-sm text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={rescheduleStart}
                    onChange={(e) => setRescheduleStart(e.target.value)}
                    className="w-full px-3 py-2 border border-black rounded-lg text-sm text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Time</label>
                  <input
                    type="time"
                    value={rescheduleEnd}
                    onChange={(e) => setRescheduleEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <button
                onClick={() => handleAction('reschedule', { newDate: rescheduleDate, newStartTime: rescheduleStart, newEndTime: rescheduleEnd })}
                disabled={isLoading !== null || !rescheduleDate || !rescheduleStart || !rescheduleEnd}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
              >
                {isLoading === 'reschedule' ? 'Rescheduling...' : 'Reschedule Booking'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
