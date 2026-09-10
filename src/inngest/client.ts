import { Inngest } from 'inngest';

/**
 * Inngest client singleton.
 *
 * Configure with your Inngest signing key from the Inngest dashboard.
 * This key is used to sign events and authenticate with Inngest's API.
 */

export const inngest = new Inngest({
  id: 'baddiesplug-lashes',
  // Set INNGEST_SIGNING_KEY in your .env
  // Get it from: https://inngest.com/[your-account]/settings
  signingKey: process.env.INNGEST_SIGNING_KEY ?? undefined,
});
