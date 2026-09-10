import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring. We recommend adjusting this value in production.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Error filtering for server-side
  beforeSend(event) {
    // Filter out expected errors (like admin auth failures from testing)
    if (event.message && event.message.includes('AdminUnauthorized')) {
      return null;
    }
    return event;
  },
});
