# Implementation Handoff — Stages 6–10

**Date:** September 29, 2026
**Repository:** `baddiesplug-lashes` · **Branch:** `new-features`
**Plan:** `agent/new-features/implementation/implementation-plan.md`
**Scope of this session:** Stages 6–10 implemented, validated, committed and pushed to `new-features`. `main` untouched; no merge to `test` after the Stage 4 checkpoint (the single authorized `test` merge was already consumed).

---

## Commits made today (all on `new-features`, pushed)

| Commit | Stage | Summary |
|---|---|---|
| `728267c` | 6 | Before/after client gallery |
| `8c52b52` | 7 | Analytics V2 |
| `abd2847` | 8 | Admin Calendar V2 |
| `33dbae6` | 9 | Advanced availability rules |
| `6e43cb7` | 10 | Loyalty + promotional codes |

Stages 1–5 were completed in a prior session (commits `2cec3d1`, `3b92787`, `b8e8723`, `6a8d196`, `2b82190`).

---

## Stage 6 — Before/After Client Gallery (`728267c`)

- **Migration `0015_before_after_gallery.sql`**: table `before_after_gallery` with `is_public` / `client_consent` defaulting to `false`, optional completed-booking link, FKs `service_id` → services (SET NULL), `booking_id` → bookings (SET NULL). Forward-only.
- **Schema**: `beforeAfterGallery` + relations.
- **Storage**: `generateBeforeAfterKey(imageId, 'before' | 'after')` → `gallery/before-after/<id>-<kind>.webp`; both images re-encoded to WebP via the existing Sharp pipeline.
- **Domain** `src/lib/before-after/index.ts`: `getBeforeAfterEntries`, `getPublicBeforeAfterEntries` (filters `isPublic=true`), `getPublicBeforeAfterForService`, `isCompletedBooking`, `canPublish`.
- **API** `src/app/api/admin/before-after/route.ts`: GET / POST (multipart `beforeFile` + `afterFile`) / PATCH / DELETE. **Consent guard:** publication requires `clientConsent=true`; revoking consent force-unpublishes; entries are never public just because they were uploaded. DELETE removes both R2 objects.
- **UI**: admin page `src/app/admin/before-after/page.tsx` + `BeforeAfterManager.tsx`; public `BeforeAfterShowcase` mounted on `/gallery-view`; AdminNav "Content" section entry.
- **Tests**: `tests/lib/stage6-before-after.test.ts` — 19 passing.

## Stage 7 — Analytics V2 (`8c52b52`)

- **Domain** `src/lib/analytics/v2.ts`: `getAnalyticsV2(range)`, `AnalyticsRange {from, to}`, `defaultRange(30)`.
- **Explicit metric definitions** (`METRIC_DEFINITIONS`): `OUTCOME_DENOMINATOR` = completed/cancelled/no_show; `REVENUE_STATUSES` = approved/completed; `pct()` returns `null` (never a misleading 0%) when the denominator is ≤ 0.
- Metrics: revenue trend, average booking value, outcome rates, reschedule rate (previousBookingId / engagement), repeat customers (≥ 2 bookings), most-booked services, service combinations (`string_agg`), popular days/times, booking sources (`bookings.bookingSource`), cancellation reasons from the durable `booking_event` audit metadata (`analytics_cancellation_reason ?? reason`, bucket `'unspecified'`), slot utilization vs the standard template (Tue–Fri = 8h).
- `getDiscountImpact` initially a neutral stub; **wired to real columns in Stage 10**.
- Admin analytics page extended with an "Extended Metrics (last 30 days)" section.
- **Tests**: `tests/lib/stage7-analytics-v2.test.ts` — 13 passing.

## Stage 8 — Admin Calendar V2 (`abd2847`)

- **Domain** `src/lib/calendar/index.ts` — **READ-ONLY model**: `getCalendarRange(from, to)` → `{days: CalendarDay[]}` (slots with availability flags from `getStandardSlots` + overrides − occupancy, blocked[], opened[], bookings[] with customer/service snapshots), `enumerateDays`.
- **UI**: `src/app/admin/calendar/page.tsx` + client `AdminCalendar.tsx` — day/week/month views, Monday week start, Lagos "today" via `Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Lagos'})`, view switcher (`view=` + `date=` params), Prev/Today/Next, booking cards link to existing booking detail, "Create Booking" links into `/admin/bookings/create?date=`. **No drag-and-drop, no fetch/mutation — a single source of truth for slot math, no second mutation path.**
- AdminNav "Bookings" section entry.
- **Tests**: `tests/lib/stage8-calendar.test.ts` — 9 passing.

## Stage 9 — Advanced Availability Rules (`33dbae6`)

- **Migration `0016_availability_rules.sql`**: table `availability_rules` with rule types `date_range_block` / `weekday_open` / `weekday_hours` / `recurring_break`.
- **Centralized precedence resolver** `src/lib/availability/rules.ts`, documented and enforced in order:
  1. Base operating schedule (`isBusinessDay` + `getStandardSlots`, Tue–Fri)
  2. Advanced rules (`resolveRulesForDate`, `getSlotsWithRules` — closures empty the day, custom hours generate 2-hour slots, recurring breaks filter overlapping slots)
  3. Admin overrides (`availability_overrides` — explicit admin intent can re-open rule-closed dates; blocks always close)
  4. Existing booking occupancy (evaluated LAST; never weakened by rule changes)
- `src/lib/availability/index.ts` `getAvailableSlots` now consumes `getSlotsWithRules(date, await getActiveRules())`; overrides and occupancy unchanged as layers 3/4.
- **API** `src/app/api/admin/availability/rules/route.ts` (GET/POST/PATCH/DELETE, zod `discriminatedUnion`, `invalidateAvailabilityCache()` on every write); UI `RulesManager.tsx` mounted on the availability page ("Advanced Rules").
- **Tests**: `tests/lib/stage9-availability-rules.test.ts` — 12 passing.

## Stage 10 — Loyalty + Promotional Codes (`6e43cb7`)

- **Migration `0017_loyalty_codes.sql`**: tables `loyalty_codes` (code unique, `code_type` ∈ 'loyalty' | 'promo', `customer_id` FK cascade, `discount_percent` 1–100, `applicable_service_ids` JSON text, `starts_at`/`expires_at`, `usage_limit`/`usage_count`, `is_active`, `revoked_at`, note) + `loyalty_code_redemptions` (per-use audit with `discount_amount` snapshot); `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_code / discount_amount / final_total`. Journal entry idx 17 appended.
- **Domain** `src/lib/loyalty/index.ts`:
  - Admin CRUD: `createLoyaltyCode` (validated; loyalty codes require a customer; duplicate codes rejected), `listLoyaltyCodes` (with redemption counts), `setLoyaltyCodeActive`, `revokeLoyaltyCode`, `getLoyaltyCodeRedemptions`.
  - `getCustomerCodes(customerId)` — assigned loyalty + general promo codes for the read-only Rewards view.
  - **Server-side validation** `validateAndApplyCode({code, customerId, serviceIds, subtotal})`: guard chain = format → exists → ownership (loyalty codes usable only by their customer) → active → not revoked → startsAt/expiresAt window → usage limit → applicable services (null = all; otherwise cart must include at least one). Discount = `round(subtotal × pct / 100)`, capped at subtotal; `finalTotal = subtotal − discount`. Nothing is written by validation.
  - **Atomic redemption** `recordRedemption(...)`: usage increment re-checks the limit inside the UPDATE (`usage_count < usage_limit`), so two concurrent bookings cannot both consume the last use; a conflict throws `CODE_REDEMPTION_CONFLICT` and rolls back the **whole booking transaction**.
  - `depositFromFinalTotal(finalTotal)` — deposit = max(50% of FINAL total, 500000 kobo). **Deposit rules apply after the discount.**
- **Booking integration** (`src/lib/booking/index.ts` `createBooking` + `src/app/api/booking/route.ts`): the client sends only the code **string** (zod-validated format); the discount is computed exclusively from the server-side `calculateBookingTotal` price snapshot — client-computed amounts are never trusted. Booking row snapshots `discount_code` / `discount_amount` / `final_total`; catalogue `total`/`subtotal` stay untouched; `depositRequired` and the WhatsApp payment link use post-discount totals; redemption + usage increment run inside the same transaction as the booking insert. Customer/admin confirmation emails include the discount line.
- **Admin**: `src/app/api/admin/loyalty/route.ts` (GET list + customers / `?redemptionsFor=` usage inspection, POST create, PATCH activate/deactivate/revoke — all `requireAdminSession`-guarded), page `src/app/admin/loyalty/page.tsx` + `LoyaltyManager.tsx`, AdminNav "People" entry "Loyalty & Promos".
- **Customer**: `RewardsSection.tsx` on `/account` — read-only list of assigned codes (code, discount %, status badge, remaining uses, expiry).
- **Analytics**: `getDiscountImpact` in `src/lib/analytics/v2.ts` now reads real `bookings.discount_amount` (revenue-status bookings in range), replacing the Stage 7 stub while keeping the `{bookingsWithDiscount, totalDiscount}` shape.
- **Tests**: `tests/lib/stage10-loyalty.test.ts` — 15 passing.

---

## Bug found and fixed today (before it shipped)

Migrations **0016** and **0017** were originally written with **camelCase column names** (`"ruleType"`, `"codeType"`, `"dayOfWeek"`, …) while the Drizzle schema maps those properties to **snake_case** (`'rule_type'`, `'code_type'`, `'day_of_week'`, …). Migration 0017's FK `DO $$` blocks even referenced `"customer_id"` — a column its own table didn't create — so the migration would have failed at runtime, and had it succeeded, every Drizzle query on those tables would have errored. Caught during Stage 10 review; both migrations were rewritten to snake_case before commit. Migration 0015 was verified correct.

---

## Final Validation (run after Stage 10)

- `npx tsc --noEmit` — **clean**.
- `npx vitest run` — **296 passing / 306**. The only 10 failures are the pre-existing environmental failures in `tests/auth/oauth.test.ts` (no local Postgres — accepted baseline from before this session). Note: the baseline was previously quoted as "10 failures in oauth + tests" — today's run confirms exactly 10, all oauth, and all 296 others pass, including the 68 new Stage 6–10 tests (19 + 13 + 9 + 12 + 15).
- `npm run build` (`next build`) — **succeeded**; all new routes present (`/admin/loyalty`, `/admin/calendar`, `/admin/before-after`, `/api/admin/loyalty`, `/api/admin/availability/rules`, `/api/admin/before-after`).
- Migration review 0015–0017: **no destructive statements** (no DROP TABLE / DROP COLUMN / TRUNCATE / DELETE FROM); all forward-only (`IF NOT EXISTS`, `DO $$` FK guards); journal sequential through idx 17.

---

## Branch state (as of September 29, 2026)

| Branch | Points at | Contents |
|---|---|---|
| `new-features` | `6e43cb7` | **All 10 stages.** Stages 1–5 (commits `2cec3d1`, `3b92787`, `b8e8723`, `6a8d196`, `2b82190`) + today's Stages 6–10 (`728267c`, `8c52b52`, `abd2847`, `33dbae6`, `6e43cb7`). Pushed to origin. |
| `test` | `6a8d196` | Stages 1–4 only — the Stage 4 checkpoint merge (the single authorized `new-features → test` merge, already consumed). **Stages 5–10 are NOT merged here** per instructions. |
| `main` | `edc97fa` | **Untouched** — pre-sprint production state. Never modified during the sprint. |

## Notes for the next session

- Migrations 0015–0017 have **never been applied to any shared environment** (`test` predates them); they must run on first deploy of `new-features`.
- Deposits: with a discount applied, `depositRequired` = max(50% of final total, 500000 kobo); without one, unchanged `calculateBookingTotal` behavior. Existing bookings are unaffected (snapshot columns are nullable).
- Availability precedence (Stage 9) lives solely in `src/lib/availability/rules.ts` — do not re-implement precedence elsewhere.
- Stage 7's relaxed journal assertion (`tags[tags.length-1] !== '0014_...'`) remains compatible with future migrations.
- The booking flow UI does not yet surface a code-entry field; the API accepts `discountCode` today, so the frontend input is the natural next increment.
