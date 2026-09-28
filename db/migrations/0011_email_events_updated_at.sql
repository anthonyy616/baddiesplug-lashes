-- 0011: email_events lease/claim timestamp.
--
-- Companion to the email worker's atomic claim: processEmailEvent() flips
-- pending -> processing and stores a lease timestamp in updated_at so
-- concurrent dispatchers cannot double-send and abandoned claims expire.
--
-- Forward-only, nullable, no existing rows modified. Safe to re-run.

ALTER TABLE "email_events" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "email_events_status_updated_at_idx"
  ON "email_events" ("status", "updated_at");
