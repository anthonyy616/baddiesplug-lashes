'use client';

const SLOTS = [
  { startTime: '09:00', endTime: '11:00' },
  { startTime: '12:00', endTime: '14:00' },
  { startTime: '14:00', endTime: '16:00' },
  { startTime: '16:00', endTime: '18:00' },
];

interface SlotSelectionProps {
  date: string;
  slots: { date: string; startTime: string; endTime: string; available: boolean }[];
  selectedSlot: { startTime: string; endTime: string } | null;
  onSlotSelect: (slot: { startTime: string; endTime: string }) => void;
  onBack: () => void;
  isLoading: boolean;
  loadingMessage: string;
}

export default function SlotSelection({
  date,
  slots,
  selectedSlot,
  onSlotSelect,
  onBack,
  isLoading,
  loadingMessage,
}: SlotSelectionProps) {
  // Get available slots for the selected date
  const availableSlots = slots.filter(s => s.date === date && s.available);
  const unavailableSlots = slots.filter(s => s.date === date && !s.available);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Select a Time Slot</h3>

      {date && (
        <p className="text-gray-600">
          Available slots for <span className="font-medium">{date}</span>:
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">{loadingMessage}</p>
        </div>
      ) : (
        <div className="grid gap-4 mt-4">
          {/* Available slots */}
          {availableSlots.map((slot) => {
            const isSelected = selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime;
            return (
              <button
                key={`${slot.date}-${slot.startTime}`}
                onClick={() => onSlotSelect({ startTime: slot.startTime, endTime: slot.endTime })}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected 
                    ? 'border-burgundy bg-burgundy/5' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</p>
                      <p className="text-sm text-green-600">Available</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-burgundy border-2 border-burgundy flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Unavailable slots */}
          {unavailableSlots.map((slot) => (
            <button
              key={`${slot.date}-${slot.startTime}-unavailable`}
              disabled
              className="text-left p-4 rounded-lg border border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-500">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</p>
                    <p className="text-sm text-gray-400">Unavailable</p>
                  </div>
                </div>
              </div>
            </button>
          ))}

          {/* No slots available */}
          {availableSlots.length === 0 && slots.filter(s => s.date === date).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No slots available for this date. Please select another date.</p>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white border border-gray-200" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-50 opacity-50" />
          <span>Unavailable</span>
        </div>
      </div>

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p><strong>Note:</strong> Each appointment is 2 hours. Please arrive on time for your scheduled slot.</p>
      </div>

      {/* Back Button */}
      <button
        onClick={onBack}
        className="mt-4 px-4 py-2 text-gray-600 hover:text-gray-900"
      >
        ← Back to Date Selection
      </button>
    </div>
  );
}
