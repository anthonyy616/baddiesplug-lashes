-- New bookings are auto-approved. Existing historical statuses are preserved.
ALTER TABLE bookings
  ALTER COLUMN status SET DEFAULT 'confirmed';