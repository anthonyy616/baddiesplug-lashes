import type { TimelineEntry } from '@/lib/booking/timeline';

/**
 * Shared visual timeline renderer (Stage 5). Purely presentational — the
 * admin and customer pages pass different (already-filtered) entry lists.
 */
export default function BookingActivityTimeline({
  entries,
  variant,
}: {
  entries: TimelineEntry[];
  variant: 'admin' | 'customer';
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-6">
      {entries.map((entry) => (
        <li key={entry.id} className="ml-6">
          <span
            className={`absolute -left-1.5 flex h-3 w-3 rounded-full ${
              entry.eventType === 'cancelled'
                ? 'bg-red-500'
                : entry.eventType === 'completed'
                  ? 'bg-blue-500'
                  : entry.eventType === 'approved'
                    ? 'bg-emerald-500'
                    : entry.eventType === 'payment_recorded'
                      ? 'bg-green-500'
                      : entry.eventType === 'no_show' || entry.eventType === 'rejected'
                        ? 'bg-orange-500'
                        : 'bg-gray-400'
            }`}
            aria-hidden="true"
          />
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {entry.label}
              {variant === 'admin' && entry.actorType !== 'system' && (
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  ({entry.actorType})
                </span>
              )}
            </p>
            <time
              dateTime={entry.occurredAt}
              className="text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap"
            >
              {new Date(entry.occurredAt).toLocaleString('en-NG', {
                timeZone: 'Africa/Lagos',
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </time>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 break-words">
            {entry.description}
          </p>
        </li>
      ))}
    </ol>
  );
}
