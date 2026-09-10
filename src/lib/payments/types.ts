/**
 * Payment provider-agnostic types and interface.
 *
 * The rest of the app (booking flow, admin, checkout UI) talks to this
 * interface, never directly to "manual" or "Paystack". When Paystack is
 * added later, implement this same interface in paystack.ts and swap the
 * active provider in index.ts.
 */

export type PaymentType = 'deposit' | 'balance' | 'full' | 'other';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overpaid';

export interface PaymentRecord {
  id: string;
  bookingId: string;
  amount: number; // NGN kobo
  type: PaymentType;
  note: string | null;
  recordedBy: string | null; // admin user ID or null for system
  createdAt: Date;
  paymentProvider: string; // which provider recorded this (e.g. 'manual', 'paystack')
  providerReference?: string; // external reference from provider (Paystack transaction ID, etc.)
}

export interface PaymentIntent {
  bookingId: string;
  amount: number; // NGN kobo
  type: PaymentType;
  description?: string;
}

export interface PaymentStatusResult {
  status: PaymentStatus;
  totalPaid: number; // NGN kobo
  depositRequired: number; // NGN kobo
  balanceDue: number; // NGN kobo (0 if fully paid)
  payments: PaymentRecord[];
}

/**
 * Interface that all payment providers must implement.
 *
 * Today: only manual implementation exists (admin records payments).
 * Future: Paystack implements createCharge + handleWebhook in addition.
 */
export interface PaymentProvider {
  /**
   * Record a payment manually (admin action today, could be webhook callback later).
   */
  recordPayment(
    bookingId: string,
    amount: number,
    type: PaymentType,
    note?: string,
    recordedBy?: string
  ): Promise<PaymentRecord>;

  /**
   * Get payment status for a booking.
   */
  getPaymentStatus(bookingId: string): Promise<PaymentStatusResult>;

  /**
   * Create a charge via the payment provider.
   * Returns a URL to redirect the customer to, or a client token.
   * Paystack-only — not implemented for manual provider.
   */
  createCharge?(intent: PaymentIntent): Promise<{
    checkoutUrl?: string;
    clientToken?: string;
    reference: string;
  }>;

  /**
   * Handle a webhook payload from the payment provider.
   * Verifies signature, checks idempotency, updates payment record.
   * Paystack-only — not implemented for manual provider.
   */
  handleWebhook?(payload: unknown, signature?: string): Promise<{
    success: boolean;
    bookingId?: string;
    amount?: number;
    error?: string;
  }>;
}
