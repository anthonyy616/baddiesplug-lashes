/**
 * Payment provider factory — exports the currently-active provider.
 *
 * Today: manual provider only.
 * Future: when Paystack is added, change this to return PaystackPaymentProvider
 * based on environment variable or feature flag.
 */

import { ManualPaymentProvider } from './manual';
import type { PaymentProvider } from './types';

let cachedProvider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  // Determine which provider to use
  // TODO: when Paystack is added, check an env var like PAYMENT_PROVIDER
  // and instantiate the appropriate provider
  const provider = process.env.PAYMENT_PROVIDER;

  if (provider === 'paystack') {
    // Will be implemented when Paystack integration is added
    throw new Error('Paystack provider not yet implemented');
  }

  // Default: manual provider (today's implementation)
  cachedProvider = new ManualPaymentProvider();
  return cachedProvider;
}

// Re-export types for consumers
export type { PaymentProvider, PaymentRecord, PaymentIntent, PaymentStatusResult, PaymentType, PaymentStatus } from './types';

// Re-export provider classes for testing or direct use if needed
export { ManualPaymentProvider } from './manual';
export { PaystackPaymentProvider } from './paystack';
