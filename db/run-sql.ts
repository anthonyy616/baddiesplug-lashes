import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

/**
 * Minimal SQL file runner + catalog backup for environments without psql.
 *
 * Usage:  npx tsx db/run-sql.ts db/pricelist-update.sql
 *
 * 1. Backs up services / addons / service_images to db/backups/*.json
 * 2. Executes the SQL file (BEGIN/COMMIT inside the file make it atomic)
 * 3. Prints verification rows
 */

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  connect_timeout: 15,
});

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx db/run-sql.ts <path-to-sql-file>');
  process.exit(1);
}

async function main() {
  // --- Backup affected tables (JSON, restorable via INSERT if ever needed) ---
  mkdirSync('db/backups', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const [services, addons, serviceImages] = await Promise.all([
    sql`SELECT * FROM services ORDER BY slug`,
    sql`SELECT * FROM addons ORDER BY name`,
    sql`SELECT * FROM service_images ORDER BY service_id, display_order`,
  ]);

  writeFileSync(`db/backups/services-${stamp}.json`, JSON.stringify(services, null, 2));
  writeFileSync(`db/backups/addons-${stamp}.json`, JSON.stringify(addons, null, 2));
  writeFileSync(`db/backups/service_images-${stamp}.json`, JSON.stringify(serviceImages, null, 2));
  console.log(`✓ Backup written to db/backups/ (services=${services.length}, addons=${addons.length}, service_images=${serviceImages.length})`);

  // --- Run the migration file ---
  const script = readFileSync(file, 'utf8');
  // postgres.js can execute multi-statement strings; DO $$ blocks included.
  await sql.unsafe(script);
  console.log(`✓ Executed ${file}\n`);

  // --- Verification ---
  const activeServices = await sql`
    SELECT category, display_order, name, price, duration_minutes, is_active
    FROM services
    WHERE deleted_at IS NULL AND slug IN
      ('classic-lash-extensions','volume-lash-extensions','hybrid-lash-extensions',
       'brow-lamination','brow-tint','brow-wax','brow-shape-trim','the-brow-duo')
    ORDER BY category, display_order`;
  console.table(activeServices.map((r) => ({ ...r, price_display: `₦${(r.price / 100).toLocaleString('en-NG')}` })));

  const activeAddons = await sql`
    SELECT display_order, name, price FROM addons WHERE is_active ORDER BY display_order`;
  console.table(activeAddons.map((r) => ({ ...r, price_display: `₦${(r.price / 100).toLocaleString('en-NG')}` })));

  const imageCounts = await sql`
    SELECT s.slug, count(si.id) AS image_count
    FROM services s LEFT JOIN service_images si ON si.service_id = s.id
    WHERE s.deleted_at IS NULL
    GROUP BY s.slug ORDER BY s.slug`;
  console.table(imageCounts);
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error('✗ Failed:', err.message);
    await sql.end();
    process.exit(1);
  });
