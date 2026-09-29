-- 0015: before/after client gallery (Stage 6).
--
-- Structured before/after client results, extending the media/gallery
-- infrastructure. Each entry is a PAIR of images (before + after), admin-
-- managed, with explicit consent/publication control.
--
-- CONSENT RULE: an entry is NEVER public just because it was uploaded —
-- `is_public` starts false and only an explicit admin publication action
-- (with client consent recorded) makes it appear on the public site.
--
-- Booking association is OPTIONAL and points at COMPLETED bookings only via
-- application-level checks. Private booking reference images live under
-- `reference/<bookingId>/...` keys and are NEVER gallery media.

CREATE TABLE IF NOT EXISTS "before_after_gallery" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  -- Before image (required)
  "before_storage_key" varchar(500) NOT NULL,
  "before_public_url" varchar(500) NOT NULL,
  "before_width" integer,
  "before_height" integer,
  -- After image (required)
  "after_storage_key" varchar(500) NOT NULL,
  "after_public_url" varchar(500) NOT NULL,
  "after_width" integer,
  "after_height" integer,
  -- Catalogue assignment (optional, kept on service delete)
  "service_id" uuid,
  -- Optional association with a completed booking (audit/traceability only —
  -- never exposes private booking reference images).
  "booking_id" uuid,
  -- Copy
  "caption" varchar(120),
  "alt_text" varchar(255),
  -- Publication control: false until an explicit consented publication.
  "is_public" boolean NOT NULL DEFAULT false,
  "client_consent" boolean NOT NULL DEFAULT false,
  -- Ordering for the public showcase.
  "display_order" integer NOT NULL DEFAULT 0,
  "uploaded_by" varchar(255),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'before_after_gallery_service_id_services_id_fk'
  ) THEN
    ALTER TABLE "before_after_gallery"
      ADD CONSTRAINT "before_after_gallery_service_id_services_id_fk"
      FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'before_after_gallery_booking_id_bookings_id_fk'
  ) THEN
    ALTER TABLE "before_after_gallery"
      ADD CONSTRAINT "before_after_gallery_booking_id_bookings_id_fk"
      FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "before_after_gallery_public_idx"
  ON "before_after_gallery" ("is_public", "display_order");
CREATE INDEX IF NOT EXISTS "before_after_gallery_service_id_idx"
  ON "before_after_gallery" ("service_id");
CREATE INDEX IF NOT EXISTS "before_after_gallery_booking_id_idx"
  ON "before_after_gallery" ("booking_id");
