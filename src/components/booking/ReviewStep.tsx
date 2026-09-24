'use client';

import { formatSlotLabel } from './StickySummaryBar';

export interface ReviewData {
  id: string;
  name: string;
  price: number;
  kind: 'service' | 'addon';
}

interface ReviewStepProps {
  items: ReviewData[];
  date: string | null;
  slot: { startTime: string; endTime: string } | null;
  subtotal: number;
  deposit: number;
  phone: string;
  notes: string;
  photoCount: number;
}

const formatPrice = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(kobo / 100);

export default function ReviewStep({
  items,
  date,
  slot,
  subtotal,
  deposit,
  phone,
  notes,
  photoCount,
}: ReviewStepProps) {
  const formattedDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-NG', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="space-y-6">
      <section aria-label="Booking summary" className="rounded-xl border border-line dark:border-line-dark divide-y divide-line dark:divide-line-dark overflow-hidden">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between px-4 py-3 bg-white dark:bg-surface-dark">
            <span className="text-ink dark:text-ink-dark">
              {item.name}
              {item.kind === 'addon' && (
                <span className="text-xs text-ink-secondary dark:text-ink-dark-secondary ml-1.5">add-on</span>
              )}
            </span>
            <span className="font-medium text-ink dark:text-ink-dark">{formatPrice(item.price)}</span>
          </div>
        ))}

        <div className="flex justify-between px-4 py-3 bg-surface-inset dark:bg-surface-inset-dark">
          <span className="text-sm text-ink-secondary dark:text-ink-dark-secondary">Subtotal</span>
          <span className="font-medium text-ink dark:text-ink-dark">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between px-4 py-3 bg-surface-inset dark:bg-surface-inset-dark">
          <span className="text-sm text-ink-secondary dark:text-ink-dark-secondary">Required deposit</span>
          <span className="font-bold text-burgundy dark:text-burgundy-lifted">{formatPrice(deposit)}</span>
        </div>

        <div className="px-4 py-3 bg-white dark:bg-surface-dark">
          <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary">Appointment</p>
          <p className="font-medium text-ink dark:text-ink-dark mt-0.5">
            {formattedDate}
            {slot && ` · ${formatSlotLabel(slot)}`}
          </p>
        </div>

        <div className="px-4 py-3 bg-white dark:bg-surface-dark">
          <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary">Phone</p>
          <p className="font-medium text-ink dark:text-ink-dark mt-0.5">{phone || '—'}</p>
        </div>

        {notes && (
          <div className="px-4 py-3 bg-white dark:bg-surface-dark">
            <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary">Notes</p>
            <p className="text-ink dark:text-ink-dark mt-0.5 whitespace-pre-wrap">{notes}</p>
          </div>
        )}

        {photoCount > 0 && (
          <div className="px-4 py-3 bg-white dark:bg-surface-dark">
            <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary">Reference photos</p>
            <p className="font-medium text-ink dark:text-ink-dark mt-0.5">{photoCount} attached</p>
          </div>
        )}
      </section>

      <p className="text-xs text-ink-secondary dark:text-ink-dark-secondary">
        Your booking is auto-approved — payment is arranged separately via WhatsApp. The required
        deposit is due to secure your confirmed appointment.
      </p>
    </div>
  );
}
