// Sentry configuration for CLI
// This file is only loaded when @sentry/nextjs package is installed.
// To enable Sentry, run: npm install @sentry/nextjs

try {
  const Sentry = require('@sentry/nextjs');

  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Source maps upload configuration
    // This is used by Sentry CLI during build
    project: {
      name: 'baddiesplug-lashes',
      mode: 'production',
    },
  });
} catch {
  // Sentry not installed — ignore
}
