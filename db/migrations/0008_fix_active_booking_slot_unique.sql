-- Completed, cancelled, rejected, and no-show bookings must not block a slot.
-- Replace any legacy full unique index with the active-bookings-only index.

DROP INDEX IF EXISTS "active_booking_slot_unique";

CREATE UNIQUE INDEX "active_booking_slot_unique"
  ON "bookings" ("appointment_date", "start_time", "end_time")
  WHERE "status" IN ('pending', 'confirmed');