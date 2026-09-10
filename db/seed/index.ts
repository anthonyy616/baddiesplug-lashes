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

// Sample Lash Services
const lashServices = [
  {
    name: 'Classic Lash Extensions',
    slug: 'classic-lash-extensions',
    description: 'Natural-looking eyelash extensions that enhance your own lashes.',
    notes: 'Individual lashes applied to natural lashes. Full set includes 80-120 lashes.',
    price: 35000, // ₦35,000 in kobo
    durationMinutes: 120,
    category: 'lash',
    displayOrder: 1,
  },
  {
    name: 'Volume Lash Extensions',
    slug: 'volume-lash-extensions',
    description: 'Dramatic, voluminous lashes made with handmade volume wisps.',
    notes: 'Multiple finer lashes fanned together for a fuller look. Full set includes 40-60 volume wisps.',
    price: 50000, // ₦50,000 in kobo
    durationMinutes: 120,
    category: 'lash',
    displayOrder: 2,
  },
  {
    name: 'Hybrid Lash Extensions',
    slug: 'hybrid-lash-extensions',
    description: 'Combination of classic and volume lashes for dimension and fullness.',
    notes: 'Classic and volume lashes combined for a customized look. Full set includes 50-80 lashes.',
    price: 45000, // ₦45,000 in kobo
    durationMinutes: 120,
    category: 'lash',
    displayOrder: 3,
  },
  {
    name: 'Lash Lift & Tint',
    slug: 'lash-lift-tint',
    description: 'Lift and tint your natural lashes for a no-makeup look.',
    notes: 'Chemical process that curls natural lashes. Lasts 6-8 weeks. Includes lash tint.',
    price: 25000, // ₦25,000 in kobo
    durationMinutes: 60,
    category: 'lash',
    displayOrder: 4,
  },
  {
    name: 'Lash Lift Only',
    slug: 'lash-lift-only',
    description: 'Chemical curl for natural lashes without tint.',
    notes: 'Curling treatment for natural lashes. Lasts 6-8 weeks.',
    price: 20000, // ₦20,000 in kobo
    durationMinutes: 45,
    category: 'lash',
    displayOrder: 5,
  },
  {
    name: 'Lash Tint Only',
    slug: 'lash-tint-only',
    description: 'Darken your natural lashes with a semi-permanent tint.',
    notes: 'Semi-permanent dye for natural lashes. Lasts 3-4 weeks.',
    price: 15000, // ₦15,000 in kobo
    durationMinutes: 30,
    category: 'lash',
    displayOrder: 6,
  },
];

// Sample Eyebrow Services
const eyebrowServicesSeed = [
  {
    name: 'Brow Shape & Trim',
    slug: 'brow-shape-trim',
    description: 'Professional eyebrow shaping and trimming.',
    notes: 'Includes consultation, shaping according to face shape, and light trim.',
    price: 10000, // ₦10,000 in kobo
    durationMinutes: 30,
    category: 'eyebrow',
    displayOrder: 1,
  },
  {
    name: 'Microblading (First Session)',
    slug: 'microblading-first-session',
    description: 'Semi-permanent eyebrow tattooing for natural-looking brows.',
    notes: 'First of two sessions. Includes consultation and design. Touch-up session required after 4-6 weeks.',
    price: 150000, // ₦150,000 in kobo
    durationMinutes: 120,
    category: 'eyebrow',
    displayOrder: 2,
  },
  {
    name: 'Microblading Touch-Up',
    slug: 'microblading-touch-up',
    description: 'Follow-up session for microblading to perfect results.',
    notes: 'Second session to perfect and enhance initial microblading work.',
    price: 50000, // ₦50,000 in kobo
    durationMinutes: 60,
    category: 'eyebrow',
    displayOrder: 3,
  },
  {
    name: 'Brow Lamination',
    slug: 'brow-lamination',
    description: 'Chemical process to set brows in an upward, fluffy position.',
    notes: 'Includes brow soap for daily grooming. Lasts 4-6 weeks.',
    price: 20000, // ₦20,000 in kobo
    durationMinutes: 45,
    category: 'eyebrow',
    displayOrder: 4,
  },
  {
    name: 'Brow Tint',
    slug: 'brow-tint',
    description: 'Semi-permanent dye to darken eyebrow hair.',
    notes: 'Lasts 3-4 weeks. Great for those with light brows.',
    price: 10000, // ₦10,000 in kobo
    durationMinutes: 20,
    category: 'eyebrow',
    displayOrder: 5,
  },
  {
    name: 'Brow Artistry',
    slug: 'brow-artistry',
    description: 'Hand-drawn strokes to create fuller, perfectly shaped brows.',
    notes: 'Individual strokes drawn with a needle. Lasts 1-2 years.',
    price: 80000, // ₦80,000 in kobo
    durationMinutes: 120,
    category: 'eyebrow',
    displayOrder: 6,
  },
];

// Sample Add-ons
const addonsSeed = [
  {
    name: 'LED Under Eye Treatment',
    description: 'LED light therapy to reduce puffiness and dark circles.',
    price: 5000,
    isActive: true,
    displayOrder: 1,
  },
  {
    name: 'Lash Lift Add-On',
    description: 'Add a lash lift to your lash extension appointment.',
    price: 10000,
    isActive: true,
    displayOrder: 2,
  },
  {
    name: 'Brow Lamination Add-On',
    description: 'Add brow lamination to your brow service.',
    price: 8000,
    isActive: true,
    displayOrder: 3,
  },
  {
    name: 'Lash Tint Add-On',
    description: 'Add lash tint to any lash service.',
    price: 5000,
    isActive: true,
    displayOrder: 4,
  },
  {
    name: 'Brow Tint Add-On',
    description: 'Add brow tint to any brow service.',
    price: 5000,
    isActive: true,
    displayOrder: 5,
  },
  {
    name: 'Under Eye Brightening',
    description: 'Concealer application and brightening treatment.',
    price: 3000,
    isActive: true,
    displayOrder: 6,
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
      }
    }
    console.log(`✓ ${serviceCount} services created\n`);

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
