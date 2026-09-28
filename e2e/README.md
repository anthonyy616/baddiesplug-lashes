# E2E (Playwright)

Run against a live dev server with a reachable database:

```bash
npm run dev                 # terminal 1
npx playwright install chromium   # first time only
npx playwright test         # terminal 2
```

Config: `playwright.config.ts` (base URL from `E2E_BASE_URL`, default
http://localhost:3000).

## Auth

Admin/customer specs skip gracefully (or run read-only) when no session
exists. For full coverage, capture storage states once with real accounts and
reference them in the specs' `test.use({ storageState })`:

```ts
test.use({ storageState: 'e2e/.auth/admin.json' });
```

## Coverage

- `booking.spec.ts` — booking flow end-to-end, double-click idempotency,
  success copy contract (never "auto-approved"), notification filter
  contract, email-event payload probe.
- `admin-actions.spec.ts` — approval, approval email financial contract,
  reschedule with custom time (replacement created, approval carried over,
  original cancelled and linked), reschedule conflict (original unchanged),
  admin cancellation.
