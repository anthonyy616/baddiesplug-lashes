-- Deactivate refill add-ons while preserving historical booking snapshots.

BEGIN;

UPDATE addons
SET is_active = false,
    updated_at = now()
WHERE name IN (
  'Lash Refill — The Soft Baddie (Hybrid)',
  'Lash Refill — I Am Baddie Full (Volume)',
  'Lash Refill — Baddie Extra (Mega Volume)'
)
AND is_active = true;

UPDATE addons
SET display_order = CASE name
      WHEN 'Lash Removal' THEN 1
      WHEN 'Bottom Lashes' THEN 2
    END,
    updated_at = now()
WHERE is_active = true
  AND name IN ('Lash Removal', 'Bottom Lashes');

DO $$
DECLARE
  active_refills int;
  active_catalog_addons int;
BEGIN
  SELECT count(*) INTO active_refills
  FROM addons
  WHERE is_active = true
    AND name IN (
      'Lash Refill — The Soft Baddie (Hybrid)',
      'Lash Refill — I Am Baddie Full (Volume)',
      'Lash Refill — Baddie Extra (Mega Volume)'
    );

  IF active_refills <> 0 THEN
    RAISE EXCEPTION 'Refill add-on deactivation failed verification. Rolling back.';
  END IF;

  SELECT count(*) INTO active_catalog_addons
  FROM addons
  WHERE is_active = true
    AND name IN ('Lash Removal', 'Bottom Lashes');

  IF active_catalog_addons <> 2 THEN
    RAISE EXCEPTION 'Expected exactly Lash Removal and Bottom Lashes to remain active. Rolling back.';
  END IF;
END $$;

COMMIT;