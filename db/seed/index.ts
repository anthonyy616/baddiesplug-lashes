import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';

const sql = neon(process.env.DATABASE_URL!);

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
const eyebrowServices = [
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
const addons = [
  {
    name: 'LED Under Eye Treatment',
    description: 'LED light therapy to reduce puffiness and dark circles.',
    price: 5000, // ₦5,000 in kobo
    isActive: true,
    displayOrder: 1,
  },
  {
    name: 'Lash Lift Add-On',
    description: 'Add a lash lift to your lash extension appointment.',
    price: 10000, // ₦10,000 in kobo
    isActive: true,
    displayOrder: 2,
  },
  {
    name: 'Brow Lamination Add-On',
    description: 'Add brow lamination to your brow service.',
    price: 8000, // ₦8,000 in kobo
    isActive: true,
    displayOrder: 3,
  },
  {
    name: 'Lash Tint Add-On',
    description: 'Add lash tint to any lash service.',
    price: 5000, // ₦5,000 in kobo
    isActive: true,
    displayOrder: 4,
  },
  {
    name: 'Brow Tint Add-On',
    description: 'Add brow tint to any brow service.',
    price: 5000, // ₦5,000 in kobo
    isActive: true,
    displayOrder: 5,
  },
  {
    name: 'Under Eye Brightening',
    description: 'Concealer application and brightening treatment.',
    price: 3000, // ₦3,000 in kobo
    isActive: true,
    displayOrder: 6,
  },
];

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Create admin user
    console.log('Creating admin user...');
    
    // Check if admin exists first
    const existingAdmin = await sql`
      SELECT id FROM users WHERE email = ${process.env.ADMIN_EMAIL || 'admin@baddiesplug.com'}
    `;
    
    if (existingAdmin.length === 0) {
      const adminId = uuidv4();
      await sql`
        INSERT INTO users (id, auth_user_id, name, email, role, created_at, updated_at)
        VALUES (${adminId}, ${uuidv4()}, 'Admin User', ${process.env.ADMIN_EMAIL || 'admin@baddiesplug.com'}, 'admin', NOW(), NOW())
      `;
      console.log('✓ Admin user created');
    } else {
      console.log('✓ Admin user already exists');
    }
    console.log('');

    // Create services
    console.log('Creating services...');
    let serviceCount = 0;
    for (const service of [...lashServices, ...eyebrowServices]) {
      // Check if service exists
      const existingService = await sql`
        SELECT id FROM services WHERE slug = ${service.slug}
      `;
      
      if (existingService.length === 0) {
        await sql`
          INSERT INTO services (id, name, slug, category, description, notes, price, duration_minutes, is_active, display_order, created_at, updated_at)
          VALUES (${uuidv4()}, ${service.name}, ${service.slug}, ${service.category}, ${service.description}, ${service.notes}, ${service.price}, ${service.durationMinutes}, true, ${service.displayOrder}, NOW(), NOW())
        `;
        serviceCount++;
      }
    }
    console.log(`✓ ${serviceCount} services created\n`);

    // Create addons
    console.log('Creating add-ons...');
    let addonCount = 0;
    for (const addon of addons) {
      // Check if addon exists
      const existingAddon = await sql`
        SELECT id FROM addons WHERE name = ${addon.name}
      `;
      
      if (existingAddon.length === 0) {
        await sql`
          INSERT INTO addons (id, name, description, price, is_active, display_order, created_at, updated_at)
          VALUES (${uuidv4()}, ${addon.name}, ${addon.description}, ${addon.price}, ${addon.isActive}, ${addon.displayOrder}, NOW(), NOW())
        `;
        addonCount++;
      }
    }
    console.log(`✓ ${addonCount} add-ons created\n`);

    console.log('✅ Seed completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Admin email: ${process.env.ADMIN_EMAIL || 'admin@baddiesplug.com'}`);
    console.log(`   - ${serviceCount} services (lash & brow)`);
    console.log(`   - ${addonCount} add-ons`);
    console.log('\n⚠️  Note: You will need to set a password for the admin user through Neon Auth.');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
