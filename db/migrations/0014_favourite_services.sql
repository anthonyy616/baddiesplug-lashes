-- 0014: favourite services (per authenticated customer).
--
-- Favourites belong to exactly one customer. The unique index prevents
-- duplicate favourites of the same service. Rows are removed when the
-- customer or service is deleted; deleting a service keeps history intact
-- via ON DELETE CASCADE on the favourites join table only (service snapshots
-- in bookings are untouched).

CREATE TABLE IF NOT EXISTS "favourite_services" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL,
  "service_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'favourite_services_customer_id_users_id_fk'
  ) THEN
    ALTER TABLE "favourite_services"
      ADD CONSTRAINT "favourite_services_customer_id_users_id_fk"
      FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'favourite_services_service_id_services_id_fk'
  ) THEN
    ALTER TABLE "favourite_services"
      ADD CONSTRAINT "favourite_services_service_id_services_id_fk"
      FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "favourite_services_customer_service_unique"
  ON "favourite_services" ("customer_id", "service_id");

CREATE INDEX IF NOT EXISTS "favourite_services_customer_id_idx"
  ON "favourite_services" ("customer_id");
