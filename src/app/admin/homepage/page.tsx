import { db } from '@/lib/db';
import { galleryCategoryOrder, galleryImages, homepageMedia, services } from '@/lib/db/schema';
import { and, asc, isNull } from 'drizzle-orm';
import HomepageMediaManager from './HomepageMediaManager';

export const dynamic = 'force-dynamic';

export default async function AdminHomepageMediaPage() {
  const [mediaRows, galleryRows, serviceRows, categoryRows] = await Promise.all([
    db.select().from(homepageMedia),
    db.query.galleryImages.findMany({
      orderBy: [asc(galleryImages.displayOrder), asc(galleryImages.createdAt)],
      with: { service: true },
    }),
    db
      .select({ id: services.id, name: services.name, category: services.category, displayOrder: services.displayOrder })
      .from(services)
      .where(and(services.isActive, isNull(services.deletedAt)))
      .orderBy(asc(services.category), asc(services.displayOrder), asc(services.name)),
    db
      .select()
      .from(galleryCategoryOrder)
      .orderBy(asc(galleryCategoryOrder.displayOrder), asc(galleryCategoryOrder.category)),
  ]);

  const media = {
    hero: mediaRows.find((r) => r.slot === 'hero') ?? null,
    editorial: mediaRows.find((r) => r.slot === 'editorial') ?? null,
  };

  const knownCategories = new Set(serviceRows.map((service) => service.category));
  const categories = [
    ...categoryRows.filter((row) => knownCategories.has(row.category)),
    ...Array.from(knownCategories)
      .filter((category) => !categoryRows.some((row) => row.category === category))
      .map((category, index) => ({ category, displayOrder: categoryRows.length + index })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Homepage Media</h1>
        <p className="text-gray-600">
          Upload the photos shown on the public homepage — hero, editorial and work gallery.
          Any phone format (HEIC/JPG/PNG/WEBP) works; everything is converted to fast WebP
          automatically and goes live immediately.
        </p>
      </div>

      <HomepageMediaManager
        initialHero={media.hero}
        initialEditorial={media.editorial}
        initialGallery={galleryRows.map((row) => ({
          id: row.id,
          publicUrl: row.publicUrl,
          caption: row.caption,
          altText: row.altText,
          displayOrder: row.displayOrder,
          width: row.width,
          height: row.height,
          serviceId: row.serviceId,
        }))}
        services={serviceRows}
        categories={categories}
      />
    </div>
  );
}
