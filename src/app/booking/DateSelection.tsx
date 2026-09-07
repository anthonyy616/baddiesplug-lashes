'use client';

import { useState, useEffect } from 'react';

interface DateSelectionProps {
  selectedDate: string | null;
  setSelectedDate: (date: string) => void;
  onDateSelect: (date: string) => void;
  onBack: () => void;
  isLoading: boolean;
  loadingMessage: string;
}

export default function DateSelection({
  selectedDate,
  setSelectedDate,
  onDateSelect,
  onBack,
  isLoading,
  loadingMessage,
}: DateSelectionProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  // Generate calendar days
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  
  const days = [];
  // Empty slots for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  // Actual days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
  }

  // Check if a date is bookable
  const isBookable = (date: Date) => {
    // Only allow Tuesday to Friday
    const dayOfWeek = date.getDay();
    if (dayOfWeek < 2 || dayOfWeek > 5) return false;

    // Only allow dates from today onwards
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };

  // Check if a date is selected
  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    const selected = new Date(selectedDate + 'T00:00:00');
    return date.toDateString() === selected.toDateString();
  };

  // Get today's date string
  const todayStr = new Date().toISOString().split('T')[0];

  // Navigate months
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    if (next > new Date()) {
      return;
    }
    setCurrentMonth(next);
  };

  // Handle date click
  const handleDateClick = (date: Date) => {
    if (!isBookable(date)) return;
    
    const dateStr = date.toISOString().split('T')[0];
    setSelected(date);
    setSelectedDate(dateStr);
    onDateSelect(dateStr);
  };

  // Month display
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const monthDisplay = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  // Day names
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatDateForDisplay = (date: Date) => {
    return `${date.getDate()} ${monthNames[date.getMonth()].slice(0, 3)}`;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Select a Date</h3>
      
      <div className="bg-gray-50 rounded-lg p-4">
        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            disabled={currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()}
            className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h4 className="font-medium">{monthDisplay}</h4>
          <button
            onClick={nextMonth}
            disabled={currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()}
            className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
              {day}
            </div>
          ))}
          {days.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="h-10" />;
            }

            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const bookable = isBookable(date);
            const selectedDay = isSelected(date);
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDateClick(date)}
                disabled={!bookable}
                className={`h-10 rounded-lg text-sm transition-all ${
                  isWeekend ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                  !bookable ? 'bg-gray-50 text-gray-400 cursor-not-allowed' :
                  selectedDay ? 'bg-burgundy text-white' :
                  isToday ? 'bg-burgundy/10 text-burgundy border-2 border-burgundy' :
                  'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white border border-gray-200" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-burgundy" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-100" />
          <span>Closed (Weekend)</span>
        </div>
      </div>

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p><strong>Note:</strong> We are open Tuesday through Friday only. Select a date to see available time slots.</p>
      </div>

      {/* Back Button */}
      <button
        onClick={onBack}
        className="mt-4 px-4 py-2 text-gray-600 hover:text-gray-900"
      >
        ← Back to Services
      </button>
    </div>
  );
}
