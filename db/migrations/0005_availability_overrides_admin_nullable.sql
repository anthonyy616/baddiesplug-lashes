-- Admin panel sessions are standalone (cookie-based, not users rows),
-- so the override creator may be unlinked from users.
ALTER TABLE "availability_overrides" ALTER COLUMN "created_by_admin_id" DROP NOT NULL;
