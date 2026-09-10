-- Fix double-booking protection: the previous implementation created a full
-- unique index, which permanently blocked slots after cancellation/rejection.
-- Replace it with a partial unique index covering only active bookings.
DROP INDEX IF EXISTS "active_booking_slot_unique";
CREATE UNIQUE INDEX "active_booking_slot_unique"
  ON "bookings" ("appointment_date", "start_time", "end_time")
  WHERE "status" IN ('pending', 'confirmed');
