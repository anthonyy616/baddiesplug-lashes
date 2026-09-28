-- 0012: assign homepage gallery images to services and persist gallery category order.
-- Existing images remain valid with a NULL service_id until an admin assigns them.

ALTER TABLE "gallery_images"
  ADD COLUMN IF NOT EXISTS "service_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gallery_images_service_id_services_id_fk'
  ) THEN
    ALTER TABLE "gallery_images"
      ADD CONSTRAINT "gallery_images_service_id_services_id_fk"
      FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "gallery_images_service_id_idx"
  ON "gallery_images" ("service_id");

CREATE TABLE IF NOT EXISTS "gallery_category_order" (
  "category" varchar(50) PRIMARY KEY NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO "gallery_category_order" ("category", "display_order")
SELECT category, row_number() OVER (ORDER BY category) - 1
FROM (
  SELECT DISTINCT category
  FROM "services"
  WHERE "deleted_at" IS NULL
) categories
ON CONFLICT ("category") DO NOTHING;