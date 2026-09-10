// Sentry server configuration
// This file is only loaded when @sentry/nextjs package is installed.
// To enable Sentry, run: npm install @sentry/nextjs

try {
  const Sentry = require('@sentry/nextjs');

  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring. We recommend adjusting this value in production.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Error filtering for server-side
    beforeSend(event: any) {
      // Filter out expected errors (like admin auth failures from testing)
      if (event.message && event.message.includes('AdminUnauthorized')) {
        return null;
      }
      return event;
    },
  });
} catch {
  // Sentry not installed — ignore
}
