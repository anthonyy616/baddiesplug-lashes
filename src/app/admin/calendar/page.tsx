import { requireAdminSession } from '@/lib/admin-auth';
import AdminCalendar from './AdminCalendar';
import { getCalendarRange } from '@/lib/calendar';

export const dynamic = 'force-dynamic';

function lagosToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** Monday-based week start (Lagos calendar dates). */
function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diff);
}

function monthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

function monthEnd(dateStr: string): string {
  const [y, m] = dateStr.slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().split('T')[0];
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  await requireAdminSession();

  const params = await searchParams;
  const view = params.view === 'day' || params.view === 'month' ? params.view : 'week';
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : lagosToday();

  let from: string;
  let to: string;
  if (view === 'day') {
    from = anchor;
    to = anchor;
  } else if (view === 'week') {
    from = weekStart(anchor);
    to = addDays(from, 6);
  } else {
    from = monthStart(anchor);
    to = monthEnd(anchor);
  }

  const { days } = await getCalendarRange(from, to);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600">
            {view === 'day' ? anchor : `${from} → ${to}`} · operational view (read-only; actions open the
            existing booking flows)
          </p>
        </div>
      </div>
      <AdminCalendar view={view} anchor={anchor} from={from} to={to} days={days} />
    </div>
  );
}
