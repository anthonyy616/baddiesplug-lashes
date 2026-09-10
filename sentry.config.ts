import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Source maps upload configuration
  // This is used by Sentry CLI during build
  project: {
    name: 'baddiesplug-lashes',
    mode: 'production',
  },
});
