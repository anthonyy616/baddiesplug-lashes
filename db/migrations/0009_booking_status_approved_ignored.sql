-- Booking status lifecycle: add 'approved' and 'ignored'.
--
-- Lifecycle:
--   confirmed -> approved            (admin, after reviewing payment proof)
--   confirmed|approved -> no_show    (admin only; the scheduled job never
--                                     creates no_show)
--   confirmed -> ignored             (scheduled job only, for untouched past
--                                     bookings; ignored bookings stay visible
--                                     in admin history, are hidden from
--                                     customers, and release their time slot)
--
-- Forward-only and safe with existing production rows: 'pending', 'confirmed',
-- 'cancelled', 'rejected', 'completed', and 'no_show' are all valid varchar
-- values and are NOT rewritten, renamed, or deleted. The status column stays a
-- varchar (no PostgreSQL enum) so unknown/legacy values remain readable.
--
-- Only the partial unique slot index changes: 'approved' bookings now occupy
-- appointment slots alongside 'pending' and 'confirmed'. 'ignored' (and the
-- other terminal outcomes) release slots, which is enforced by simply not
-- being listed in the index predicate.
--
-- Safe to re-run: the DROP ... IF EXISTS guard makes this idempotent.

DROP INDEX IF EXISTS "active_booking_slot_unique";

CREATE UNIQUE INDEX "active_booking_slot_unique"
  ON "bookings" ("appointment_date", "start_time", "end_time")
  WHERE "status" IN ('pending', 'confirmed', 'approved');
