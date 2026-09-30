import { db } from '@/lib/db';
import { payments, bookings } from '@/lib/db/schema';
import { eq, and, sum, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { PaymentProvider, PaymentRecord, PaymentStatusResult, PaymentType, PaymentStatus } from './types';
import { recordBookingEvent } from '@/lib/booking/audit';

/**
 * Manual payment provider.
 *
 * Today this is the only provider. Admin records payments manually (e.g.
 * after receiving WhatsApp payment confirmation). When Paystack is added,
 * implement the same interface and swap the active provider in index.ts.
 */

export class ManualPaymentProvider implements PaymentProvider {
  async recordPayment(
    bookingId: string,
    amount: number,
    type: PaymentType,
    note?: string,
    recordedBy?: string
  ): Promise<PaymentRecord> {
    const now = new Date();

    const record: PaymentRecord = {
      id: uuidv4(),
      bookingId,
      amount,
      type,
      note: note ?? null,
      recordedBy: recordedBy ?? null,
      createdAt: now,
      paymentProvider: 'manual',
    };

    await db.insert(payments).values({
      id: record.id,
      bookingId: record.bookingId,
      amount: record.amount,
      paymentType: record.type,
      note: record.note,
      recordedByAdminId: record.recordedBy ?? null,
      createdAt: record.createdAt,
    });

    // Durable audit event (Stage 5): payment recording appears in the booking
    // activity timeline. Amount is stored in kobo; the timeline formats it.
    const bookingRow = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      columns: { reference: true },
    });
    await recordBookingEvent({
      bookingId,
      eventType: 'payment_recorded',
      actorType: 'admin',
      metadata: {
        reference: bookingRow?.reference ?? null,
        amount,
        paymentType: type,
        ...(note ? { note } : {}),
      },
    });

    return record;
  }

  async getPaymentStatus(bookingId: string): Promise<PaymentStatusResult> {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    const paymentRows = await db.query.payments.findMany({
      where: eq(payments.bookingId, bookingId),
      orderBy: (p) => [p.createdAt],
    });

    const paymentRecords: PaymentRecord[] = paymentRows.map((row) => ({
      id: row.id,
      bookingId: row.bookingId,
      amount: row.amount,
      type: row.paymentType as PaymentType,
      note: row.note,
      recordedBy: row.recordedByAdminId ?? null,
      createdAt: row.createdAt,
      paymentProvider: 'manual',
    }));

    const totalPaid = paymentRecords.reduce((sum, p) => sum + p.amount, 0);
    const depositRequired = booking.depositRequired;
    const total = booking.total;
    const balanceDue = total - totalPaid;

    let status: PaymentStatus = 'pending';
    if (totalPaid >= total) {
      status = 'paid';
    } else if (totalPaid >= depositRequired) {
      status = 'partial';
    }

    if (totalPaid > total) {
      status = 'overpaid';
    }

    return {
      status,
      totalPaid,
      depositRequired,
      balanceDue: Math.max(0, balanceDue),
      payments: paymentRecords,
    };
  }

  // createCharge and handleWebhook are not implemented for manual provider
  // They'll be added when Paystack provider is created
}
