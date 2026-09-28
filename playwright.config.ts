import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Requires a running dev server with a reachable database:
 *   npm run dev
 *   npx playwright install chromium   (first time only)
 *   npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // bookings share slots; run serially for determinism
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
