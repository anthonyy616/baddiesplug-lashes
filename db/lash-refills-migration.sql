-- Move lash refills from add-ons into the Lash Services > Refills subsection.
-- Existing add-on rows are retained for historical booking references.

BEGIN;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS subcategory varchar(50);

INSERT INTO services (
  id, name, slug, category, subcategory, description, notes,
  price, duration_minutes, is_active, display_order, created_at, updated_at
)
VALUES
  (
    gen_random_uuid(),
    'The Soft Baddie',
    'the-soft-baddie-refill',
    'lash',
    'refills',
    'A two-week maintenance appointment to refresh your existing Soft Baddie set, replacing lashes that have naturally shed and restoring fullness and definition.',
    'Hybrid refill. Refills are recommended every 2 weeks to maintain the fullness and appearance of your set. Refill pricing applies to existing Baddies Plug sets that are suitable for a refill. If too much of the original set has shed, a new full set may be required.',
    1900000,
    90,
    true,
    1,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'I Am Baddie Full',
    'i-am-baddie-full-refill',
    'lash',
    'refills',
    'A two-week maintenance appointment to restore the fullness, density and shape of your existing I Am Baddie Full set.',
    'Volume refill. Refills are recommended every 2 weeks to maintain the fullness and appearance of your set. Refill pricing applies to existing Baddies Plug sets that are suitable for a refill. If too much of the original set has shed, a new full set may be required.',
    2500000,
    90,
    true,
    2,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'Baddie Extra',
    'baddie-extra-refill',
    'lash',
    'refills',
    'A two-week maintenance appointment designed to restore the maximum fullness and density of your existing Baddie Extra set.',
    'Mega Volume refill. Refills are recommended every 2 weeks to maintain the fullness and appearance of your set. Refill pricing applies to existing Baddies Plug sets that are suitable for a refill. If too much of the original set has shed, a new full set may be required.',
    3000000,
    90,
    true,
    3,
    now(),
    now()
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  description = EXCLUDED.description,
  notes = EXCLUDED.notes,
  price = EXCLUDED.price,
  duration_minutes = EXCLUDED.duration_minutes,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = now();

UPDATE addons
SET is_active = false,
    updated_at = now()
WHERE name IN (
  'Lash Refill — The Soft Baddie (Hybrid)',
  'Lash Refill — I Am Baddie Full (Volume)',
  'Lash Refill — Baddie Extra (Mega Volume)'
);

DO $$
BEGIN
  IF (SELECT count(*) FROM services WHERE slug IN (
    'the-soft-baddie-refill', 'i-am-baddie-full-refill', 'baddie-extra-refill'
  ) AND is_active = true AND category = 'lash' AND subcategory = 'refills') <> 3 THEN
    RAISE EXCEPTION 'Refill service migration failed verification.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM addons
    WHERE is_active = true
      AND name IN (
        'Lash Refill — The Soft Baddie (Hybrid)',
        'Lash Refill — I Am Baddie Full (Volume)',
        'Lash Refill — Baddie Extra (Mega Volume)'
      )
  ) THEN
    RAISE EXCEPTION 'Legacy refill add-ons are still active.';
  END IF;
END $$;

COMMIT;
