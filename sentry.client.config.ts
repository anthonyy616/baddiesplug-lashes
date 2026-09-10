// Sentry client configuration
// This file is only loaded when @sentry/nextjs package is installed.
// To enable Sentry, run: npm install @sentry/nextjs

try {
  const Sentry = require('@sentry/nextjs');

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring. We recommend adjusting this value in production.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Set up error filtering to avoid noise from development
    beforeSend(event: any) {
      // Don't send errors from local development if not needed
      if (process.env.NODE_ENV !== 'production') {
        // Still allow errors in dev for testing, but you can filter here
      }
      return event;
    },

    // Define how to filter/modify breadcrumbs before they're attached
    beforeSendTransaction(event: any) {
      // Ignore API calls to health checks or static assets
      const url = event.request?.url ?? '';
      if (url.includes('/api/health') || url.includes('.ico') || url.includes('.svg')) {
        return null;
      }
      return event;
    },
  });
} catch {
  // Sentry not installed — ignore
}
