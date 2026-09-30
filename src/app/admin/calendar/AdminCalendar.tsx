'use client';

import Link from 'next/link';
import type { CalendarDay } from '@/lib/calendar';

/**
 * Admin Calendar V2 client shell (Stage 8).
 *
 * NOTE ON ACTIONS: this component intentionally has NO booking mutation.
 * - Clicking a booking opens the booking detail (where the existing actions
 *   and Rescheduling V2 live).
 * - "Create booking" links to the existing admin create flow with the date
 *   pre-filled.
 * Drag/drop rescheduling is deliberately NOT implemented: the only reschedule
 * path is the explicit Rescheduling V2 form, which validates and confirms
 * before persisting.
 */

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200 line-through',
  no_show: 'bg-orange-100 text-orange-800 border-orange-200',
  rejected: 'bg-gray-100 text-gray-600 border-gray-200',
  ignored: 'bg-stone-100 text-stone-600 border-stone-200',
};

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function prettyDate(dateStr: string): string {
  // Parse at UTC midnight and format in UTC: parsing local midnight while
  // formatting in UTC shifted every label one day back for UTC+1 (Lagos)
  // viewers — e.g. Saturday's closed card rendered as "Fri, 2 Oct".
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function AdminCalendar({
  view,
  anchor,
  from,
  to,
  days,
}: {
  view: 'day' | 'week' | 'month';
  anchor: string;
  from: string;
  to: string;
  days: CalendarDay[];
}) {
  const dayHref = (date: string) => `/admin/calendar?view=day&date=${date}`;

  return (
    <div className="space-y-4">
      {/* View switcher + date navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['day', 'week', 'month'] as const).map((v) => (
            <Link
              key={v}
              href={`/admin/calendar?view=${v}&date=${anchor}`}
              className={`px-4 py-2 text-sm capitalize ${
                view === v ? 'bg-burgundy text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {v}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Link
            href={`/admin/calendar?view=${view}&date=${prevAnchor(view, anchor)}`}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            ← Prev
          </Link>
          <Link
            href={`/admin/calendar?view=${view}&date=${shiftDate(anchor, 0)}`}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            Today
          </Link>
          <Link
            href={`/admin/calendar?view=${view}&date=${nextAnchor(view, anchor)}`}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            Next →
          </Link>
        </div>
        <Link
          href={`/admin/bookings/create?date=${anchor}`}
          className="px-4 py-2 bg-burgundy text-white rounded-lg text-sm hover:bg-burgundy/90"
        >
          + Create Booking
        </Link>
      </div>

      {view === 'month' ? (
        <MonthGrid days={days} from={from} />
      ) : (
        <div className={`grid gap-4 ${view === 'day' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
          {days.map((day) => (
            <DayCard key={day.date} day={day} onDayLink={dayHref} />
          ))}
        </div>
      )}
    </div>
  );
}

function prevAnchor(view: 'day' | 'week' | 'month', anchor: string): string {
  if (view === 'day') return shiftDate(anchor, -1);
  if (view === 'week') return shiftDate(anchor, -7);
  const [y, m] = anchor.slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().split('T')[0];
}

function nextAnchor(view: 'day' | 'week' | 'month', anchor: string): string {
  if (view === 'day') return shiftDate(anchor, 1);
  if (view === 'week') return shiftDate(anchor, 7);
  const [y, m] = anchor.slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().split('T')[0];
}

function DayCard({ day, onDayLink }: { day: CalendarDay; onDayLink: (d: string) => string }) {
  const hasBlocks = day.blocked.length > 0;
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${hasBlocks ? 'ring-1 ring-red-200' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <Link href={onDayLink(day.date)} className="font-medium text-gray-900 hover:text-burgundy">
          {prettyDate(day.date)}
        </Link>
        {day.bookings.length > 0 && (
          <span className="text-xs text-gray-500">{day.bookings.length} booking{day.bookings.length > 1 ? 's' : ''}</span>
        )}
      </div>

      {day.blocked.length > 0 && (
        <div className="mb-2 text-xs text-red-600">
          Blocked: {day.blocked.map((b) => `${b.startTime}–${b.endTime}`).join(', ')}
        </div>
      )}

      {day.bookings.length === 0 ? (
        <p className="text-xs text-gray-400">
          {day.slots.length === 0 ? 'Closed (no standard slots)' : 'No bookings'}
        </p>
      ) : (
        <div className="space-y-2">
          {day.bookings.map((b) => (
            <Link
              key={b.id}
              href={`/admin/bookings/${b.id}`}
              className={`block border rounded-md px-2.5 py-2 text-xs hover:shadow-sm ${STATUS_STYLES[b.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{b.startTime}–{b.endTime}</span>
                <span className="uppercase tracking-wide text-[10px]">{b.status.replace('_', ' ')}</span>
              </div>
              <div className="truncate mt-0.5">{b.customerName} · {b.serviceName}</div>
              <div className="font-mono text-[10px] opacity-70">{b.reference}</div>
            </Link>
          ))}
        </div>
      )}

      {day.slots.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {day.slots.map((s) => (
            <span
              key={`${s.startTime}-${s.endTime}`}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                s.available ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400 line-through'
              }`}
              title={`${s.startTime}–${s.endTime} ${s.available ? 'available' : 'taken/blocked'}`}
            >
              {s.startTime}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MonthGrid({ days, from }: { days: CalendarDay[]; from: string }) {
  // Pad the start so the 1st lands on its weekday column (Monday-first).
  const firstDow = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7; // 0=Mon
  const cells: (CalendarDay | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="text-center text-xs font-medium text-gray-500 py-1">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) =>
          day === null ? (
            <div key={`pad-${i}`} className="min-h-24 bg-gray-50/50 rounded" />
          ) : (
            <div key={day.date} className="min-h-24 bg-white rounded border border-gray-100 p-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{Number(day.date.slice(-2))}</span>
                {day.bookings.length > 0 && (
                  <span className="text-[10px] bg-burgundy/10 text-burgundy rounded-full px-1.5">
                    {day.bookings.length}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {day.bookings.slice(0, 2).map((b) => (
                  <Link
                    key={b.id}
                    href={`/admin/bookings/${b.id}`}
                    className={`block rounded px-1 py-0.5 text-[10px] truncate border ${STATUS_STYLES[b.status] ?? 'bg-gray-50 border-gray-200'}`}
                    title={`${b.startTime} ${b.customerName} (${b.status})`}
                  >
                    {b.startTime} {b.customerName}
                  </Link>
                ))}
                {day.bookings.length > 2 && (
                  <Link
                    href={`/admin/calendar?view=day&date=${day.date}`}
                    className="block text-[10px] text-gray-400 hover:text-burgundy"
                  >
                    +{day.bookings.length - 2} more
                  </Link>
                )}
              </div>
              {day.blocked.length > 0 && (
                <div className="mt-1 text-[9px] text-red-500 truncate" title="Blocked periods">
                  ⛔ blocked
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
