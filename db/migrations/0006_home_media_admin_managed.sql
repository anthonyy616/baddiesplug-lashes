-- Homepage media managed from the admin panel.
-- Written as minimal + idempotent: the meta snapshots for migrations 0001-0005
-- were gitignored on this checkout, so drizzle-kit could not produce a
-- reliable incremental diff. These statements are safe to run whether or not
-- the earlier migrations were applied.

-- Admin-controlled flag: feature this service on the homepage.
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS "services_is_featured_idx" ON "services" USING btree ("is_featured");

-- Hero / editorial image slots (one row per slot; re-upload replaces the row
-- and points at a fresh R2 key so the CDN cache never serves a stale image).
CREATE TABLE IF NOT EXISTS "homepage_media" (
	"slot" varchar(50) PRIMARY KEY NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"public_url" varchar(500) NOT NULL,
	"alt_text" varchar(255),
	"width" integer,
	"height" integer,
	"uploaded_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Admin-managed homepage work gallery.
CREATE TABLE IF NOT EXISTS "gallery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"public_url" varchar(500) NOT NULL,
	"caption" varchar(120),
	"alt_text" varchar(255),
	"display_order" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"uploaded_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "gallery_images_display_order_idx" ON "gallery_images" USING btree ("display_order");
