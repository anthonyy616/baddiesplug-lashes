-- 0017: loyalty + promotional code system (Stage 10).
--
-- ONE unified retention/discount architecture for loyalty rewards and
-- promotional codes. Admin creates and assigns codes; customers can only
-- SEE codes assigned to them and apply them at booking time. All validation
-- and discount computation happens SERVER-SIDE; the browser never decides a
-- discount amount.
--
-- Snapshot rule: bookings copy the discount details at booking time
-- (discount_code, discount_amount, final_total), so later code changes never
-- rewrite history. Redemptions are recorded per use for audit/analytics.

CREATE TABLE IF NOT EXISTS "loyalty_codes" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  -- Unique code string customers enter (uppercase-normalized by app layer).
  "code" varchar(40) NOT NULL,
  -- 'loyalty' (assigned to a specific customer) or 'promo' (general).
  "code_type" varchar(10) NOT NULL DEFAULT 'loyalty',
  -- Required for loyalty codes; NULL for general promo codes.
  "customer_id" uuid,
  -- Discount percentage (1-100).
  "discount_percent" integer NOT NULL,
  -- Optional catalogue scoping: NULL = applicable to all active services.
  -- Applicable service ids are stored as a JSON array of uuid strings.
  "applicable_service_ids" text,
  "starts_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  -- NULL = unlimited.
  "usage_limit" integer,
  "usage_count" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  -- Revocation is distinct from deactivation for audit clarity.
  "revoked_at" timestamp with time zone,
  "note" varchar(255),
  "created_by_admin_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_codes_customer_id_users_id_fk'
  ) THEN
    ALTER TABLE "loyalty_codes"
      ADD CONSTRAINT "loyalty_codes_customer_id_users_id_fk"
      FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_codes_code_unique" ON "loyalty_codes" ("code");
CREATE INDEX IF NOT EXISTS "loyalty_codes_customer_id_idx" ON "loyalty_codes" ("customer_id");
CREATE INDEX IF NOT EXISTS "loyalty_codes_active_idx" ON "loyalty_codes" ("is_active");

-- Per-use redemption audit: who used which code on which booking.
CREATE TABLE IF NOT EXISTS "loyalty_code_redemptions" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "code_id" uuid NOT NULL,
  "booking_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  -- Discount applied at redemption time (kobo) — snapshot for analytics.
  "discount_amount" integer NOT NULL,
  "redeemed_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_code_redemptions_code_id_loyalty_codes_id_fk'
  ) THEN
    ALTER TABLE "loyalty_code_redemptions"
      ADD CONSTRAINT "loyalty_code_redemptions_code_id_loyalty_codes_id_fk"
      FOREIGN KEY ("code_id") REFERENCES "loyalty_codes"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_code_redemptions_booking_id_bookings_id_fk'
  ) THEN
    ALTER TABLE "loyalty_code_redemptions"
      ADD CONSTRAINT "loyalty_code_redemptions_booking_id_bookings_id_fk"
      FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_code_redemptions_customer_id_users_id_fk'
  ) THEN
    ALTER TABLE "loyalty_code_redemptions"
      ADD CONSTRAINT "loyalty_code_redemptions_customer_id_users_id_fk"
      FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "loyalty_code_redemptions_code_id_idx" ON "loyalty_code_redemptions" ("code_id");
CREATE INDEX IF NOT EXISTS "loyalty_code_redemptions_booking_id_idx" ON "loyalty_code_redemptions" ("booking_id");

-- Booking-side discount snapshot (NEVER rewritten by later code changes):
-- the original total is kept in `total`; `final_total` = total - discount.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "discount_code" varchar(40);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "discount_amount" integer;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "final_total" integer;
