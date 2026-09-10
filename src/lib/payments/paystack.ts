/**
 * Paystack payment provider — placeholder.
 *
 * NOT built yet. This file exists to establish the interface boundary now,
 * so when Paystack integration is added later, you implement this interface
 * and swap the active provider in index.ts.
 *
 * When implementing, you'll need:
 * - Paystack public key (for checkout) and secret key (for webhook verification)
 * - Paystack webhook signature verification using HMAC-SHA512
 * - Idempotency key = Paystack event ID to prevent double-processing
 */

import type { PaymentProvider, PaymentIntent } from './types';

/**
 * Placeholder Paystack provider.
 *
 * Throws NotImplemented errors for Paystack-specific methods until
 * the actual integration is built.
 */
export class PaystackPaymentProvider implements PaymentProvider {
  private publicKey: string;
  private secretKey: string;

  constructor(publicKey: string, secretKey: string) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
  }

  async recordPayment(
    bookingId: string,
    amount: number,
    type: string,
    note?: string,
    recordedBy?: string
  ): Promise<any> {
    // Paystack payments typically come in via webhook, not manual recording.
    // This could be used for admin-override scenarios.
    throw new Error('Not implemented: Paystack provider does not support manual recording');
  }

  async getPaymentStatus(bookingId: string): Promise<any> {
    // Would query Paystack API for transactions related to this booking
    throw new Error('Not implemented: Paystack provider payment status check');
  }

  async createCharge(intent: PaymentIntent): Promise<any> {
    /**
     * When implemented, this will:
     * 1. Create a Paystack checkout session or inline payment
     * 2. Return a checkout URL or client token
     * 3. Store a PaymentIntent record with a reference for webhook matching
     *
     * Example flow:
     * - POST to Paystack initialize endpoint with amount, email, callback_url
     * - Receive authorization URL or access code
     * - Store reference in our DB linked to bookingId
     * - Return checkoutUrl to frontend for redirect
     */
    throw new Error('Not implemented: Paystack createCharge');
  }

  async handleWebhook(payload: unknown, signature?: string): Promise<any> {
    /**
     * When implemented, this will:
     * 1. Verify Paystack webhook signature using HMAC-SHA512
     *    - Compute HMAC of request body with secret key
     *    - Compare with provided signature header
     * 2. Extract event type and data from payload
     * 3. Use idempotency key = Paystack event ID to prevent double-processing
     * 4. On successful payment event:
     *    - Look up the booking by Paystack reference
     *    - Record the payment via the same recording logic
     *    - Update booking status if fully paid
     * 5. Return success/failure response
     *
     * Paystack will retry webhooks on failure, so idempotency is critical.
     */
    throw new Error('Not implemented: Paystack webhook handler');
  }
}
