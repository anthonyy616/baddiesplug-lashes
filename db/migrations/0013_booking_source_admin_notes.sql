-- 0013: booking source + admin booking notes.
--
-- booking_source distinguishes website bookings ('customer') from bookings
-- created administratively for phone/WhatsApp/walk-in customers ('admin').
-- Existing rows are website bookings by definition. The column is NOT NULL
-- with a server default so concurrent inserts can never see NULL.
--
-- admin_booking_notes is an internal, admin-only notes field, separate from
-- the customer-entered notes which are shown on customer-facing pages.
--
-- Forward-only and non-destructive: no rows are updated or deleted.

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "booking_source" varchar(20) NOT NULL DEFAULT 'customer';

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "admin_booking_notes" text;

CREATE INDEX IF NOT EXISTS "bookings_booking_source_idx"
  ON "bookings" ("booking_source");
