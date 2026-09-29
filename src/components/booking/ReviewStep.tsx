'use client';

import { useState } from 'react';
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
  paymentDetails: {
    accountNumber: string;
    bankName: string;
    accountName: string;
  };
}

import { formatNaira } from '@/lib/format/money';

const formatPrice = formatNaira;

export default function ReviewStep({
  items,
  date,
  slot,
  subtotal,
  deposit,
  phone,
  notes,
  photoCount,
  paymentDetails,
}: ReviewStepProps) {
  const [copied, setCopied] = useState(false);
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

      <section className="mx-auto w-full max-w-md rounded-xl border border-burgundy/60 bg-burgundy/5 p-5 text-center shadow-[0_0_18px_rgba(128,30,57,0.28),inset_0_0_18px_rgba(128,30,57,0.08)] dark:border-burgundy-lifted/60 dark:bg-burgundy/10 dark:shadow-[0_0_20px_rgba(220,137,157,0.2),inset_0_0_18px_rgba(220,137,157,0.06)]">
        <h3 className="font-medium text-ink dark:text-ink-dark">Deposit payment details</h3>
        <dl className="mt-4 space-y-2 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-secondary dark:text-ink-dark-secondary">Account Number</dt>
            <dd className="font-semibold text-ink dark:text-ink-dark">{paymentDetails.accountNumber || 'Not configured'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-secondary dark:text-ink-dark-secondary">Bank Name</dt>
            <dd className="font-semibold text-ink dark:text-ink-dark">{paymentDetails.bankName || 'Not configured'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-secondary dark:text-ink-dark-secondary">Account Name</dt>
            <dd className="font-semibold text-ink dark:text-ink-dark">{paymentDetails.accountName || 'Not configured'}</dd>
          </div>
        </dl>
        <button
          type="button"
          disabled={!paymentDetails.accountNumber}
          onClick={async () => {
            await navigator.clipboard.writeText(paymentDetails.accountNumber);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
          className="mt-5 rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-burgundy/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? 'Copied' : 'Copy account number'}
        </button>
      </section>

      <p className="text-xs text-ink-secondary dark:text-ink-dark-secondary">
        Your booking is auto-approved by our system. In order to confirm your appointment, please pay
        the required deposit and send the receipt to us on whatsapp - Our whatsapp details are in the
        next page after you click &quot;Confirm Booking&quot; button below. Thank You!
      </p>
    </div>
  );
}
