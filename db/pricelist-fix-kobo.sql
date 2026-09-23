-- ============================================================================
-- CORRECTIVE MIGRATION — prices written 100x too small by first run
-- ============================================================================
-- The first run of pricelist-update.sql stored naira values as kobo
-- (e.g. 35500 instead of 3,550,000). This script multiplies the affected
-- rows by exactly 100, but ONLY where the price still equals the incorrect
-- value — so it is idempotent and safe to run more than once.
--
-- Target prices (official price list, stored as kobo = naira × 100):
--   Services: Soft Baddie 35,500 | Baddie Full 46,200 | Baddie Extra 55,100
--             Brow Lamination 15,000 | Brow Tint 10,000 | Brow Wax 5,000
--             Brow Shaping 2,000 | Brow Duo 20,000
--   Add-ons:  Refill Soft 19,000 | Refill Full 25,000 | Refill Extra 30,000
--             Lash Removal 5,000 | Bottom Lashes 15,000
-- ============================================================================

BEGIN;

UPDATE services SET
  price = price * 100,
  updated_at = now()
WHERE slug IN (
  'classic-lash-extensions',   -- 35500      -> 3,550,000  (₦35,500)
  'volume-lash-extensions',    -- 46200      -> 4,620,000  (₦46,200)
  'hybrid-lash-extensions',    -- 55100      -> 5,510,000  (₦55,100)
  'brow-lamination',           -- 15000      -> 1,500,000  (₦15,000)
  'brow-tint',                 -- 10000      -> 1,000,000  (₦10,000)
  'brow-wax',                  -- 5000       ->   500,000  (₦5,000)
  'brow-shape-trim',           -- 2000       ->   200,000  (₦2,000)
  'the-brow-duo'               -- 20000      -> 2,000,000  (₦20,000)
);

UPDATE addons SET
  price = price * 100,
  updated_at = now()
WHERE name IN (
  'Lash Refill — The Soft Baddie (Hybrid)',   -- 19000 -> 1,900,000 (₦19,000)
  'Lash Refill — I Am Baddie Full (Volume)',  -- 25000 -> 2,500,000 (₦25,000)
  'Lash Refill — Baddie Extra (Mega Volume)', -- 30000 -> 3,000,000 (₦30,000)
  'Lash Removal',                             --  5000 ->   500,000 (₦5,000)
  'Bottom Lashes'                             -- 15000 -> 1,500,000 (₦15,000)
);

-- Verification gate: every target row must now hold its exact kobo price.
DO $$
DECLARE
  bad int;
BEGIN
  SELECT count(*) INTO bad FROM services
  WHERE (slug = 'classic-lash-extensions' AND price <> 3550000)
     OR (slug = 'volume-lash-extensions'  AND price <> 4620000)
     OR (slug = 'hybrid-lash-extensions'  AND price <> 5510000)
     OR (slug = 'brow-lamination'         AND price <> 1500000)
     OR (slug = 'brow-tint'               AND price <> 1000000)
     OR (slug = 'brow-wax'                AND price <> 500000)
     OR (slug = 'brow-shape-trim'         AND price <> 200000)
     OR (slug = 'the-brow-duo'            AND price <> 2000000);

  IF bad > 0 THEN
    RAISE EXCEPTION 'Service price correction failed verification. Rolling back.';
  END IF;

  SELECT count(*) INTO bad FROM addons
  WHERE is_active = true
    AND (
      (name = 'Lash Refill — The Soft Baddie (Hybrid)'  AND price <> 1900000)
   OR (name = 'Lash Refill — I Am Baddie Full (Volume)' AND price <> 2500000)
   OR (name = 'Lash Refill — Baddie Extra (Mega Volume)' AND price <> 3000000)
   OR (name = 'Lash Removal'                            AND price <> 500000)
   OR (name = 'Bottom Lashes'                           AND price <> 1500000)
    );

  IF bad > 0 THEN
    RAISE EXCEPTION 'Add-on price correction failed verification. Rolling back.';
  END IF;
END $$;

COMMIT;
