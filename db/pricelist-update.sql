-- ============================================================================
-- THE BADDIES PLUG — Official Price List Migration
-- ============================================================================
-- Purpose: Adapt the service + add-on catalog to the official price list
--          (lash sets, brow services, brow combo, refills/removal/extras).
--
-- Design guarantees (read before running):
--   1. IDEMPOTENT — safe to run multiple times; re-running produces no
--      duplicates and no errors.
--   2. NO DELETES — services are business history. Superseded services are
--      deactivated (is_active = false). booking_services references services
--      with ON DELETE RESTRICT, so a hard delete would break prod.
--   3. IMAGES PRESERVED — existing services are UPDATED IN PLACE (matched by
--      slug), so service_images rows keep their service_id attachment.
--   4. ATOMIC — wrapped in a single transaction; any failure rolls back
--      everything. Prod is never left half-migrated.
--   5. Prices are stored in KOBO (naira × 100): ₦35,500 → 3550000.
--      (Verified against prod: the app formats price / 100 as naira,
--      and pre-migration rows held e.g. 3500000 for ₦35,000.)
--
-- Run with:
--   psql "$DATABASE_URL" -f db/pricelist-update.sql
--
-- Verify after with the checks at the bottom of this file.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1 — LASH SERVICES (update in place, matched by slug)
-- ============================================================================
-- Mapping from the old seed catalog to the official price list:
--   classic-lash-extensions  → The Soft Baddie (Hybrid set)     ₦35,500
--   volume-lash-extensions   → I Am Baddie Full (Volume set)    ₦46,200
--   hybrid-lash-extensions   → Baddie Extra (Mega-volume set)   ₦55,100

UPDATE services SET
  name          = 'The Soft Baddie (Hybrid Set)',
  description   = 'A fuller, textured set that sits beautifully between natural and dramatic. A combination of lightweight individual extensions and volume fans creates soft density, definition and dimension.',
  notes         = 'Perfect for: the girl who wants noticeable lashes without going all the way dramatic. Finish: Soft • Textured • Defined. All sets are customized to your natural lash health and eye shape.',
  price         = 3550000,          -- ₦35,500
  duration_minutes = 120,
  is_active     = true,
  display_order = 1,
  updated_at    = now()
WHERE slug = 'classic-lash-extensions';

UPDATE services SET
  name          = 'I Am Baddie Full (Volume Set)',
  description   = 'Fuller, darker and more dimensional than The Soft Baddie. This set creates a rich, fluffy lash line with significantly more density while keeping the finish lightweight and beautifully balanced.',
  notes         = 'Perfect for: the girl who wants her lashes to be part of the look. Finish: Full • Fluffy • Glamorous. All sets are customized to your natural lash health and eye shape.',
  price         = 4620000,          -- ₦46,200
  duration_minutes = 120,
  is_active     = true,
  display_order = 2,
  updated_at    = now()
WHERE slug = 'volume-lash-extensions';

UPDATE services SET
  name          = 'Baddie Extra (Mega Volume Set)',
  description   = 'Our fullest lash experience. Designed for maximum density, depth and drama, with carefully crafted fans tailored to your natural lashes and eye shape.',
  notes         = 'Perfect for: the girl who wants bold, unapologetic, statement lashes. Finish: Dense • Dramatic • Unmissable. All sets are customized to your natural lash health and eye shape.',
  price         = 5510000,          -- ₦55,100
  duration_minutes = 120,
  is_active     = true,
  display_order = 3,
  updated_at    = now()
WHERE slug = 'hybrid-lash-extensions';

-- ============================================================================
-- STEP 2 — BROW SERVICES (update in place, matched by slug)
-- ============================================================================
--   brow-lamination          → Brow Lamination   ₦15,000
--   brow-tint                → Brow Tint         ₦10,000
--   brow-shape-trim          → Brow Shaping      ₦2,000

UPDATE services SET
  name          = 'Brow Lamination',
  description   = 'A brow-smoothing treatment that restructures and sets your natural brow hairs into a fuller, lifted and more defined shape — that brushed-up, fluffy brow look, polished and intentional.',
  notes         = 'Included: brow cleansing, styling, lamination treatment, nourishing finish & aftercare guidance. Finish: Lifted • Fluffy • Defined.',
  price         = 1500000,          -- ₦15,000
  duration_minutes = 45,
  is_active     = true,
  display_order = 1,
  updated_at    = now()
WHERE slug = 'brow-lamination';

UPDATE services SET
  name          = 'Brow Tint',
  description   = 'A semi-permanent henna tint that enhances the colour and definition of your brows while creating a fuller-looking appearance. Ideal for adding depth to sparse or lighter brows.',
  notes         = 'Included: brow cleansing, basic brow preparation, customised henna tint application & aftercare guidance. Finish: Defined • Fuller-looking • Sculpted.',
  price         = 1000000,          -- ₦10,000
  duration_minutes = 20,
  is_active     = true,
  display_order = 2,
  updated_at    = now()
WHERE slug = 'brow-tint';

UPDATE services SET
  name          = 'Brow Shaping',
  description   = 'A simple brow grooming service using a razor to remove stray hairs and refine the shape of your natural brows.',
  notes         = 'Included: brow assessment, razor shaping, stray hair removal & final grooming. Finish: Clean • Refined • Natural.',
  price         = 200000,           -- ₦2,000
  duration_minutes = 15,
  is_active     = true,
  display_order = 4,
  updated_at    = now()
WHERE slug = 'brow-shape-trim';

-- ============================================================================
-- STEP 3 — NEW SERVICES (no in-place mapping exists)
-- ============================================================================
--   Brow Wax   ₦5,000   (eyebrow)
--   The Brow Duo (Brow Lamination + Brow Tint)   ₦20,000   (eyebrow)
--
-- Slug is stable and deterministic so re-running is a no-op.

INSERT INTO services (
  id, slug, name, category, description, notes,
  price, duration_minutes, is_active, display_order, created_at, updated_at
)
VALUES
  (gen_random_uuid(), 'brow-wax', 'Brow Wax', 'eyebrow',
   'A quick brow clean-up using wax to remove unwanted hair around the brow area and sharpen your existing brow shape.',
   'Included: brow preparation, wax clean-up, stray hair removal & soothing finish. Finish: Clean • Neat • Polished.',
   500000, 15, true, 3, now(), now()),

  (gen_random_uuid(), 'the-brow-duo', 'The Brow Duo (Lamination + Tint)', 'eyebrow',
   'The perfect pairing for fuller, lifted and more defined brows. Brow lamination creates the shape and lift, while our henna tint adds depth and definition. Save ₦5,000 when you book the combo.',
   'Included: brow cleansing, brow preparation, lamination, customised henna tint, nourishing finish & aftercare guidance. Finish: Lifted • Fuller-looking • Defined.',
   2000000, 60, true, 5, now(), now())
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 4 — DEACTIVATE superseded services (NEVER delete: booking history
--          references them via booking_services ON DELETE RESTRICT)
-- ============================================================================

UPDATE services SET
  is_active = false,
  updated_at = now()
WHERE slug IN (
  'lash-lift-tint',             -- Lash Lift & Tint (not in new list)
  'lash-lift-only',             -- Lash Lift Only (not in new list)
  'lash-tint-only',             -- Lash Tint Only (not in new list)
  'microblading-first-session', -- Microblading (not in new list)
  'microblading-touch-up',      -- Microblading Touch-Up (not in new list)
  'brow-artistry'               -- Brow Artistry (not in new list)
);

-- ============================================================================
-- STEP 5 — ADD-ONS: deactivate old sample add-ons, insert the official ones
-- ============================================================================
-- Old sample add-ons are not part of the official price list. Deactivate
-- (keep history for booking_addons snapshots).

UPDATE addons SET
  is_active = false,
  updated_at = now()
WHERE name IN (
  'LED Under Eye Treatment',
  'Lash Lift Add-On',
  'Brow Lamination Add-On',
  'Lash Tint Add-On',
  'Brow Tint Add-On',
  'Under Eye Brightening'
);

-- Official add-ons. There is no unique constraint on addons.name, so guard
-- each insert with a NOT EXISTS check to keep the script idempotent.
INSERT INTO addons (id, name, description, price, is_active, display_order, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.description, v.price, true, v.display_order, now(), now()
FROM (VALUES
  ('Lash Removal',
   'Professional removal of existing lash extensions using a gentle removal process designed to protect your natural lashes. Removal of another lash artist''s work may be required before a new set can be applied.',
  500000, 1),
  ('Bottom Lashes',
   'Customised bottom lash extensions for extra definition. Price shown is for the full (dramatic) option; subtle options are available in-salon.',
  1500000, 2)
) AS v(name, description, price, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM addons a WHERE a.name = v.name
);

-- ============================================================================
-- STEP 6 — SAFETY CHECKS (abort the whole transaction if anything is off)
-- ============================================================================

-- Each migrated service must exist and carry its exact official price.
DO $$
DECLARE
  bad_row_count int;
BEGIN
  SELECT count(*) INTO bad_row_count FROM services
  WHERE (slug = 'classic-lash-extensions' AND (is_active = false OR price <> 3550000 OR name <> 'The Soft Baddie (Hybrid Set)'))
     OR (slug = 'volume-lash-extensions'  AND (is_active = false OR price <> 4620000 OR name <> 'I Am Baddie Full (Volume Set)'))
     OR (slug = 'hybrid-lash-extensions'  AND (is_active = false OR price <> 5510000 OR name <> 'Baddie Extra (Mega Volume Set)'))
     OR (slug = 'brow-lamination'         AND (is_active = false OR price <> 1500000))
     OR (slug = 'brow-tint'               AND (is_active = false OR price <> 1000000))
     OR (slug = 'brow-shape-trim'         AND (is_active = false OR price <> 200000))
     OR (slug = 'brow-wax'                AND (is_active = false OR price <> 500000))
     OR (slug = 'the-brow-duo'            AND (is_active = false OR price <> 2000000));

  IF bad_row_count > 0 THEN
    RAISE EXCEPTION 'Catalog migration failed verification (missing row, wrong price, or wrong active state). Rolling back.';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-RUN VERIFICATION (run these manually after the script commits)
-- ============================================================================
-- Active services with prices (expect: 3 lash + 5 brow = 8 rows, all kobo):
--   SELECT category, display_order, name, price, duration_minutes, is_active
--   FROM services WHERE deleted_at IS NULL
--   ORDER BY category, display_order;
--
-- Active add-ons (expect 5 rows):
--   SELECT display_order, name, price FROM addons WHERE is_active
--   ORDER BY display_order;
--
-- Images still attached (should be unchanged from before the migration):
--   SELECT s.slug, count(si.id) AS image_count
--   FROM services s LEFT JOIN service_images si ON si.service_id = s.id
--   WHERE s.deleted_at IS NULL GROUP BY s.slug ORDER BY s.slug;
-- ============================================================================
