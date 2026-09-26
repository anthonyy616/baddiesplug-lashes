'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface SuccessProps {
  reference: string;
  whatsappUrl?: string;
  bookingId?: string | null;
}

export default function Success({ reference, whatsappUrl }: SuccessProps) {
  useEffect(() => {
    // Clear any stored booking intent
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bookingIntent');
    }
  }, []);

  return (
    <div className="bg-white dark:bg-surface-dark rounded-xl border border-line dark:border-line-dark p-6 sm:p-10 text-center">
      {/* Pending badge */}
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300 text-sm font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
          Booking confirmed
      </span>

      <h1 className="font-display text-3xl text-ink dark:text-ink-dark mt-6 mb-3">
          Your booking is confirmed
      </h1>
      <p className="text-ink-secondary dark:text-ink-dark-secondary max-w-md mx-auto">
          Your booking is auto-approved by our system. You will receive a confirmation by email, and if we need to reschedule, we will contact you by email or WhatsApp.
      </p>

      <div className="mt-5 mx-auto max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-semibold">Can&apos;t find the email?</p>
        <p className="mt-1">Check your Spam or Promotions folder. If you find it there, choose <span className="font-semibold">Report not spam</span> or move it to your inbox so future booking updates arrive normally.</p>
      </div>

      {/* Reference */}
      <div className="mt-8 inline-block bg-surface-inset dark:bg-surface-inset-dark border border-line dark:border-line-dark rounded-xl px-8 py-5">
        <p className="text-xs uppercase tracking-wide text-ink-secondary dark:text-ink-dark-secondary">
          Booking reference
        </p>
        <p className="font-mono text-2xl font-bold text-burgundy dark:text-burgundy-lifted mt-1">
          {reference}
        </p>
      </div>

      {/* WhatsApp payment — secondary action, doesn't compete with pending messaging */}
      {whatsappUrl && (
        <div className="mt-8">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 border border-line dark:border-line-dark rounded-lg font-medium text-ink dark:text-ink-dark hover:border-burgundy hover:text-burgundy dark:hover:text-burgundy-lifted transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Send payment details via WhatsApp
          </a>
          <p className="text-xs text-ink-secondary dark:text-ink-dark-secondary mt-2">
            Your booking has been auto approved by our system. In order to get approved and confirmed, please send us a message on WhatsApp through the link below with proof of payment to get this booking approved. Thank you.
          </p>
          <p className="text-xs text-ink-secondary dark:text-ink-dark-secondary mt-1">
            Your booking details and deposit amount are pre-filled in the message.
          </p>
        </div>
      )}

      {/* Account link */}
      <div className="mt-10 pt-6 border-t border-line dark:border-line-dark">
        <Link
          href="/account"
          className="text-burgundy dark:text-burgundy-lifted font-medium hover:underline"
        >
          View your booking in My Account →
        </Link>
      </div>
    </div>
  );
}
