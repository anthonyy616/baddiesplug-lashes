'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { pickPrefetchDates } from '@/lib/booking-calendar';

export interface SlotInfo {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  reason?: string;
}

interface DateTimePickerProps {
  selectedDate: string | null;
  selectedSlot: SlotInfo | null;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slot: SlotInfo) => void;
}

const SLOT_LABELS: Record<string, string> = {
  '09:00': '9:00 – 11:00 AM',
  '12:00': '12:00 – 2:00 PM',
  '14:00': '2:00 – 4:00 PM',
  '16:00': '4:00 – 6:00 PM',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DateTimePicker({
  selectedDate,
  selectedSlot,
  onSelectDate,
  onSelectSlot,
}: DateTimePickerProps) {
  const today = useMemo(() => toLocalDateStr(new Date()), []);
  const initial = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  // Availability cache keyed by date string
  const [slotsByDate, setSlotsByDate] = useState<Record<string, SlotInfo[]>>({});
  const [loadingDate, setLoadingDate] = useState<string | null>(null);

  const fetchSlots = useCallback(async (date: string) => {
    if (slotsByDate[date] || loadingDate === date) return;
    setLoadingDate(date);
    try {
      const res = await fetch(`/api/availability?date=${date}`);
      if (!res.ok) {
        // Don't cache a failure as "empty" — leave this date unfetched so a
        // retry can happen. Server errors now return 500 (see API route).
        console.error(`Availability fetch failed for ${date}: HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      setSlotsByDate((prev) => ({ ...prev, [date]: data.slots || [] }));
    } catch (err) {
      console.error(`Availability fetch error for ${date}:`, err);
    } finally {
      setLoadingDate(null);
    }
  }, [slotsByDate, loadingDate]);

  // Fetch availability for all in-month bookable days when the view changes.
  // Selection logic lives in pickPrefetchDates (src/lib/booking-calendar.ts)
  // so it stays unit-testable — see the regression note there.
  useEffect(() => {
    const days = buildMonthDays(viewYear, viewMonth);
    for (const dateStr of pickPrefetchDates(
      days.map((d) => ({ dateStr: toLocalDateStr(d), dayOfWeek: d.getDay() })),
      today,
    )) {
      void fetchSlots(dateStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, today]);

  // Always ensure the selected date's slots are loaded (covers dates outside
  // the pre-fetched cap and dates selected before the month fetch completes).
  useEffect(() => {
    if (selectedDate) void fetchSlots(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const prevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const nextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const atCurrentMonth =
    viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth();

  const days = buildMonthDays(viewYear, viewMonth);
  const firstDayDow = new Date(viewYear, viewMonth, 1).getDay();

  const selectedSlots = selectedDate ? slotsByDate[selectedDate] : undefined;

  const getDateState = (d: Date): 'past' | 'closed' | 'full' | 'open' => {
    const dateStr = toLocalDateStr(d);
    const dow = d.getDay();
    if (dateStr < today) return 'past';
    if (dow < 2 || dow > 5) return 'closed';
    const slots = slotsByDate[dateStr];
    if (slots && slots.length > 0 && slots.every((s) => !s.available)) return 'full';
    return 'open';
  };

  const monthLabel = `${MONTHS[viewMonth]} ${viewYear}`;

  return (
    <div className="space-y-8">
      {/* Calendar */}
      <section aria-label="Choose a date">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            disabled={atCurrentMonth}
            aria-label="Previous month"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
          >
            ‹
          </button>
          <h3 className="font-display italic text-lg text-ink dark:text-ink-dark">{monthLabel}</h3>
          <button
            onClick={nextMonth}
            aria-label="Next month"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs text-ink-secondary dark:text-ink-dark-secondary py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayDow }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {days.map((d) => {
            const dateStr = toLocalDateStr(d);
            const state = getDateState(d);
            const isPast = state === 'past';
            const isClosed = state === 'closed';
            const isFull = state === 'full';
            const disabled = isPast || isClosed || isFull;
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === today;
            const loading = loadingDate === dateStr;

            const dow = d.getDay();
            const isBusinessDay = dow >= 2 && dow <= 5;
            // Outside the 1-month booking window
            const limit = new Date();
            limit.setMonth(limit.getMonth() + 1);
            const outsideWindow = d > limit;

            const ariaLabel = `${MONTHS[viewMonth]} ${d.getDate()}, ${viewYear}, ${
              isSelected ? 'selected' : disabled ? (isClosed ? 'closed' : isFull ? 'fully booked' : 'unavailable') : 'available'
            }`;

            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled || outsideWindow || loading}
                aria-label={ariaLabel}
                aria-disabled={disabled || outsideWindow}
                onClick={() => onSelectDate(dateStr)}
                className={`relative aspect-square rounded-full flex items-center justify-center text-sm transition-all duration-150 ${
                  isSelected
                    ? 'bg-burgundy text-white font-semibold scale-105'
                    : disabled || outsideWindow
                      ? 'text-disabled-text dark:text-disabled-text-dark cursor-not-allowed'
                      : isToday
                        ? 'text-burgundy dark:text-burgundy-lifted ring-1 ring-burgundy dark:ring-burgundy-lifted hover:bg-burgundy/5'
                        : isBusinessDay
                          ? 'text-ink dark:text-ink-dark hover:bg-burgundy/5'
                          : 'text-ink-secondary dark:text-ink-dark-secondary'
                }`}
              >
                {d.getDate()}
                {isFull && !isSelected && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-disabled-text dark:bg-disabled-text-dark" aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-ink-secondary dark:text-ink-dark-secondary">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-burgundy" /> Selected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full ring-1 ring-burgundy" /> Today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-disabled-surface dark:bg-disabled-surface-dark" /> Closed / fully booked
          </span>
        </div>
      </section>

      {/* Slots */}
      {selectedDate && (
        <section aria-label="Choose a time">
          {loadingDate === selectedDate && !selectedSlots ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : !selectedSlots || selectedSlots.length === 0 ? (
            <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary">
              No times available for this day — please pick another date.
            </p>
          ) : (
            <>
              <h3 className="text-sm font-medium text-ink dark:text-ink-dark mb-3">
                Available{' '}
                <span className="text-ink-secondary dark:text-ink-dark-secondary">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-NG', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </h3>
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-3">
                {selectedSlots.map((slot) => {
                  const isSelected = selectedSlot?.startTime === slot.startTime;
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      disabled={!slot.available}
                      aria-disabled={!slot.available}
                      aria-label={`Appointment ${SLOT_LABELS[slot.startTime] || slot.startTime}${
                        slot.available ? '' : `, ${slot.reason === 'booked' ? 'booked' : 'unavailable'}`
                      }`}
                      onClick={() => onSelectSlot(slot)}
                      className={`py-4 rounded-xl border text-sm font-medium transition-all duration-200 ${
                        isSelected
                          ? 'bg-burgundy border-burgundy text-white'
                          : slot.available
                            ? 'border-line dark:border-line-dark text-ink dark:text-ink-dark hover:border-burgundy hover:text-burgundy dark:hover:text-burgundy-lifted'
                            : 'border-line dark:border-line-dark bg-disabled-surface dark:bg-disabled-surface-dark text-disabled-text dark:text-disabled-text-dark cursor-not-allowed'
                      }`}
                    >
                      {SLOT_LABELS[slot.startTime] || `${slot.startTime} – ${slot.endTime}`}
                      {!slot.available && (
                        <span className="block text-xs font-normal mt-0.5">
                          {slot.reason === 'booked' ? 'Booked' : 'Unavailable'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function buildMonthDays(year: number, month: number): Date[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Date[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }
  return days;
}
