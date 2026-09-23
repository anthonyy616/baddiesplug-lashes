import 'dotenv/config';
import { db } from '@/lib/db';
import { services, addons, adminAuth } from '@/lib/db/schema';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';

// Keep a raw Neon client available in case drizzle-orm DB path is misconfigured.
export const sql = neon(process.env.DATABASE_URL!);

/*
Usage:
  npm run db:seed -- --admin-user <username> --admin-pass <password>

If admin args are omitted, only the catalog (services/add-ons) is seeded.
"username" is what you type at /admin/login — it is not an email.

The catalog below mirrors the official price list (db/pricelist-update.sql
performs the equivalent in-place migration for existing databases).
*/

function parseAdminArgs() {
  const args = process.argv.slice(2);
  let username: string | undefined;
  let password: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--admin-user' && i + 1 < args.length) {
      username = args[++i];
    } else if (args[i] === '--admin-pass' && i + 1 < args.length) {
      password = args[++i];
    }
  }
  return { username, password };
}

const { username: adminUsername, password: adminPassword } = parseAdminArgs();

if (adminUsername && !adminPassword) {
  console.error('Error: --admin-pass is required when --admin-user is provided.');
  process.exit(1);
}

if (!adminUsername && adminPassword) {
  console.error('Error: --admin-user is required when --admin-pass is provided.');
  process.exit(1);
}

// Official lash services — prices in NGN kobo (naira × 100):
// ₦35,500 → 3550000. The app displays price / 100 as naira.
const lashServices = [
  {
    name: 'The Soft Baddie (Hybrid Set)',
    slug: 'classic-lash-extensions',
    description:
      'A fuller, textured set that sits beautifully between natural and dramatic. A combination of lightweight individual extensions and volume fans creates soft density, definition and dimension.',
    notes:
      'Perfect for: the girl who wants noticeable lashes without going all the way dramatic. Finish: Soft • Textured • Defined. All sets are customized to your natural lash health and eye shape.',
    price: 3550000, // ₦35,500
    durationMinutes: 120,
    category: 'lash',
    displayOrder: 1,
  },
  {
    name: 'I Am Baddie Full (Volume Set)',
    slug: 'volume-lash-extensions',
    description:
      'Fuller, darker and more dimensional than The Soft Baddie. This set creates a rich, fluffy lash line with significantly more density while keeping the finish lightweight and beautifully balanced.',
    notes:
      'Perfect for: the girl who wants her lashes to be part of the look. Finish: Full • Fluffy • Glamorous. All sets are customized to your natural lash health and eye shape.',
    price: 4620000, // ₦46,200
    durationMinutes: 120,
    category: 'lash',
    displayOrder: 2,
  },
  {
    name: 'Baddie Extra (Mega Volume Set)',
    slug: 'hybrid-lash-extensions',
    description:
      'Our fullest lash experience. Designed for maximum density, depth and drama, with carefully crafted fans tailored to your natural lashes and eye shape.',
    notes:
      'Perfect for: the girl who wants bold, unapologetic, statement lashes. Finish: Dense • Dramatic • Unmissable. All sets are customized to your natural lash health and eye shape.',
    price: 5510000, // ₦55,100
    durationMinutes: 120,
    category: 'lash',
    displayOrder: 3,
  },
];

// Official brow services — prices in NGN kobo (naira × 100).
const eyebrowServicesSeed = [
  {
    name: 'Brow Lamination',
    slug: 'brow-lamination',
    description:
      'A brow-smoothing treatment that restructures and sets your natural brow hairs into a fuller, lifted and more defined shape — that brushed-up, fluffy brow look, polished and intentional.',
    notes:
      'Included: brow cleansing, styling, lamination treatment, nourishing finish & aftercare guidance. Finish: Lifted • Fluffy • Defined.',
    price: 1500000, // ₦15,000
    durationMinutes: 45,
    category: 'eyebrow',
    displayOrder: 1,
  },
  {
    name: 'Brow Tint',
    slug: 'brow-tint',
    description:
      'A semi-permanent henna tint that enhances the colour and definition of your brows while creating a fuller-looking appearance. Ideal for adding depth to sparse or lighter brows.',
    notes:
      'Included: brow cleansing, basic brow preparation, customised henna tint application & aftercare guidance. Finish: Defined • Fuller-looking • Sculpted.',
    price: 1000000, // ₦10,000
    durationMinutes: 20,
    category: 'eyebrow',
    displayOrder: 2,
  },
  {
    name: 'Brow Wax',
    slug: 'brow-wax',
    description:
      'A quick brow clean-up using wax to remove unwanted hair around the brow area and sharpen your existing brow shape.',
    notes:
      'Included: brow preparation, wax clean-up, stray hair removal & soothing finish. Finish: Clean • Neat • Polished.',
    price: 500000, // ₦5,000
    durationMinutes: 15,
    category: 'eyebrow',
    displayOrder: 3,
  },
  {
    name: 'Brow Shaping',
    slug: 'brow-shape-trim',
    description:
      'A simple brow grooming service using a razor to remove stray hairs and refine the shape of your natural brows.',
    notes:
      'Included: brow assessment, razor shaping, stray hair removal & final grooming. Finish: Clean • Refined • Natural.',
    price: 200000, // ₦2,000
    durationMinutes: 15,
    category: 'eyebrow',
    displayOrder: 4,
  },
  {
    name: 'The Brow Duo (Lamination + Tint)',
    slug: 'the-brow-duo',
    description:
      'The perfect pairing for fuller, lifted and more defined brows. Brow lamination creates the shape and lift, while our henna tint adds depth and definition. Save ₦5,000 when you book the combo.',
    notes:
      'Included: brow cleansing, brow preparation, lamination, customised henna tint, nourishing finish & aftercare guidance. Finish: Lifted • Fuller-looking • Defined.',
    price: 2000000, // ₦20,000
    durationMinutes: 60,
    category: 'eyebrow',
    displayOrder: 5,
  },
];

// Official add-ons (extras) — prices in NGN kobo (naira × 100).
const addonsSeed = [
  {
    name: 'Lash Refill — The Soft Baddie (Hybrid)',
    description:
      'Two-week maintenance appointment to refresh your existing Soft Baddie set, replacing lashes that have naturally shed and restoring fullness and definition. Recommended every 2 weeks. Applies to existing Baddies Plug sets suitable for a refill.',
    price: 1900000, // ₦19,000
    isActive: true,
    displayOrder: 1,
  },
  {
    name: 'Lash Refill — I Am Baddie Full (Volume)',
    description:
      'Two-week maintenance appointment to restore the fullness, density and shape of your existing I Am Baddie Full set. Recommended every 2 weeks. Applies to existing Baddies Plug sets suitable for a refill.',
    price: 2500000, // ₦25,000
    isActive: true,
    displayOrder: 2,
  },
  {
    name: 'Lash Refill — Baddie Extra (Mega Volume)',
    description:
      'Two-week maintenance appointment to restore the maximum fullness and density of your existing Baddie Extra set. Recommended every 2 weeks. If too much of the original set has shed, a new full set may be required.',
    price: 3000000, // ₦30,000
    isActive: true,
    displayOrder: 3,
  },
  {
    name: 'Lash Removal',
    description:
      'Professional removal of existing lash extensions using a gentle removal process designed to protect your natural lashes. Removal of another lash artist\'s work may be required before a new set can be applied.',
    price: 500000, // ₦5,000
    isActive: true,
    displayOrder: 4,
  },
  {
    name: 'Bottom Lashes',
    description:
      'Customised bottom lash extensions for extra definition. Price shown is for the full (dramatic) option; subtle options are available in-salon.',
    price: 1500000, // ₦15,000
    isActive: true,
    displayOrder: 5,
  },
];

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // --- Admin user (new cookie-based auth) ---
    if (adminUsername && adminPassword) {
      console.log('Creating admin user...');
      const existing = await db
        .query.adminAuth
        .findFirst({ where: eq(adminAuth.username, adminUsername) });

      if (!existing) {
        const hashed = await hash(adminPassword, 1);
        await db.insert(adminAuth).values({
          username: adminUsername,
          passwordHash: hashed,
        }).onConflictDoNothing();
        console.log('✓ Admin user created:', adminUsername);
      } else {
        console.log('✓ Admin user already exists:', adminUsername);
      }
      console.log('');
    }

    // --- Services ---
    console.log('Creating services...');
    let serviceCount = 0;
    for (const service of [...lashServices, ...eyebrowServicesSeed]) {
      const existingService = await db
        .query.services
        .findFirst({ where: eq(services.slug, service.slug) });

      if (!existingService) {
        await db.insert(services).values({
          id: crypto.randomUUID(),
          name: service.name,
          slug: service.slug,
          category: service.category,
          description: service.description,
          notes: service.notes,
          price: service.price,
          durationMinutes: service.durationMinutes,
          isActive: true,
          displayOrder: service.displayOrder,
        });
        serviceCount++;
      } else {
        // Existing databases are migrated in place by db/pricelist-update.sql;
        // here we only keep an existing row's copy current if it drifted.
        await db
          .update(services)
          .set({
            name: service.name,
            description: service.description,
            notes: service.notes,
            price: service.price,
            durationMinutes: service.durationMinutes,
            displayOrder: service.displayOrder,
            updatedAt: new Date(),
          })
          .where(eq(services.slug, service.slug));
      }
    }
    console.log(`✓ ${serviceCount} services created, ${[...lashServices, ...eyebrowServicesSeed].length - serviceCount} synced\n`);

    // --- Add-ons ---
    console.log('Creating add-ons...');
    let addonCount = 0;
    for (const addonItem of addonsSeed) {
      const existingAddon = await db
        .query.addons
        .findFirst({ where: eq(addons.name, addonItem.name) });

      if (!existingAddon) {
        await db.insert(addons).values({
          id: crypto.randomUUID(),
          name: addonItem.name,
          description: addonItem.description,
          price: addonItem.price,
          isActive: addonItem.isActive,
          displayOrder: addonItem.displayOrder,
        });
        addonCount++;
      }
    }
    console.log(`✓ ${addonCount} add-ons created\n`);

    console.log('✅ Seed completed successfully!');
    if (adminUsername) {
      console.log(`\n📋 Summary:`);
      console.log(`   - Admin username: ${adminUsername}`);
      console.log(`   - ${serviceCount} services (lash & brow)`);
      console.log(`   - ${addonCount} add-ons`);
    }
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
