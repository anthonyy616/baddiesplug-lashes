-- 0016: advanced availability rules (Stage 9).
--
-- Adds RECURRING rules on top of the existing architecture:
-- - availability_overrides (existing) stays the DATE-SPECIFIC override layer
--   (open/block a specific date's slot).
-- - availability_rules (new) adds RECURRING administration: holidays /
--   vacation periods / temporary closures (date-range blocks), custom working
--   days (weekday opens), date-specific working hours, and weekly recurring
--   breaks.
--
-- PRECEDENCE (implemented in src/lib/availability/rules.ts — the single
-- authority):
--   1. base operating schedule (isBusinessDay + getStandardSlots);
--   2. advanced recurring/date rules (this table);
--   3. admin overrides (availability_overrides, existing);
--   4. existing booking occupancy (slot-occupying statuses).
-- Existing bookings are NEVER invalidated by later rule changes: occupancy
-- is evaluated last and rules only affect NEW availability display. This
-- migration is forward-only and adds no columns to existing tables.

CREATE TABLE IF NOT EXISTS "availability_rules" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  -- Rule kinds:
  --   'date_range_block'  : closed every day in [startDate, endDate] (holiday,
  --                         vacation, temporary closure)
  --   'weekday_open'      : OPEN a weekday (custom working day) every week;
  --                         startTime/endTime define custom working hours
  --                         for that weekday
  --   'weekday_hours'     : replace standard hours for a weekday
  --   'recurring_break'   : weekly break window on a weekday
  "rule_type" varchar(30) NOT NULL,
  -- 0=Sunday .. 6=Saturday (weekday-scoped rules only)
  "day_of_week" integer,
  -- Inclusive bounds; both set for date-range rules, single use for others.
  "start_date" varchar(10), -- YYYY-MM-DD
  "end_date" varchar(10),   -- YYYY-MM-DD
  -- Working/break window (HH:MM) for weekday/break rules.
  "start_time" varchar(5),
  "end_time" varchar(5),
  "label" varchar(120),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by_admin_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "availability_rules_active_idx" ON "availability_rules" ("is_active");
CREATE INDEX IF NOT EXISTS "availability_rules_rule_type_idx" ON "availability_rules" ("rule_type");
CREATE INDEX IF NOT EXISTS "availability_rules_dates_idx" ON "availability_rules" ("start_date", "end_date");
