import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateBookingPaymentLink,
  generateCancellationLink,
} from '@/lib/whatsapp';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Contract tests for the booking success copy and WhatsApp deep-link.
 * See agent/implementation/booking-status-and-analytics-plan.md:
 * - Success screen shows the new auto-approval + WhatsApp instructions text
 *   under the WhatsApp button.
 * - The existing "pre-filled" line is kept.
 * - WhatsApp URL contains reference, date/time, total, and deposit.
 */

describe('booking success copy', () => {
  const src = readFileSync(
    join(process.cwd(), 'src', 'app', 'booking', 'Success.tsx'),
    'utf8'
  );

  it('shows the required auto-approval message under the WhatsApp button', () => {
    expect(src).toContain(
      'Your booking has been auto approved by our system. In order to get approved and confirmed, please send us a message on WhatsApp through the link below with proof of payment to get this booking approved. Thank you.'
    );
  });

  it('keeps the existing pre-filled message line', () => {
    expect(src).toContain(
      'Your booking details and deposit amount are pre-filled in the message.'
    );
  });

  it('keeps the WhatsApp payment link button', () => {
    expect(src).toContain('whatsappUrl');
    expect(src).toContain('Send payment details via WhatsApp');
  });
});

describe('WhatsApp booking payment link contract', () => {
  const original = process.env.WHATSAPP_NUMBER;

  beforeEach(() => {
    process.env.WHATSAPP_NUMBER = '2348012345678';
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.WHATSAPP_NUMBER;
    } else {
      process.env.WHATSAPP_NUMBER = original;
    }
  });

  it('targets the configured WhatsApp number', () => {
    const url = generateBookingPaymentLink(
      'REF123', 'Ada', '2026-10-01', '10:00', '11:00', 50000, 10000
    );
    expect(url).toContain('https://wa.me/2348012345678');
  });

  it('pre-fills reference, customer, date, time, total, and deposit in the message', () => {
    const url = generateBookingPaymentLink(
      'REF123', 'Ada', '2026-10-01', '10:00', '11:00', 50000, 10000
    );
    const text = decodeURIComponent(url.split('text=')[1]);

    expect(text).toContain('REF123');
    expect(text).toContain('Ada');
    expect(text).toContain('2026-10-01');
    expect(text).toContain('10:00 - 11:00');
    // Amounts are kobo -> naira formatted
    expect(text).toContain('500.00');
    expect(text).toContain('100.00');
    expect(text).toContain('Total');
    expect(text).toContain('Deposit Required');
  });

  it('keeps amounts in kobo-to-naira conversion (50000 kobo = 500.00)', () => {
    const url = generateBookingPaymentLink(
      'R', 'C', '2026-10-01', '10:00', '11:00', 123456, 23456
    );
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('1234.56');
    expect(text).toContain('234.56');
  });

  it('includes optional notes when provided', () => {
    const url = generateBookingPaymentLink(
      'REF', 'Ada', '2026-10-01', '10:00', '11:00', 50000, 10000, 'Cat-eye style'
    );
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('Cat-eye style');
  });

  it('produces a cancellation link with the same phone target', () => {
    const url = generateCancellationLink('REF9', 'Ada', '2026-10-01', '10:00', '11:00');
    expect(url).toContain('https://wa.me/2348012345678');
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('REF9');
    expect(text).toContain('Cancellation');
  });
});
