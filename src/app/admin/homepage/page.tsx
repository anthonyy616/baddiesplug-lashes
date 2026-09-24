import { db } from '@/lib/db';
import { homepageMedia, galleryImages } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import HomepageMediaManager from './HomepageMediaManager';

export const dynamic = 'force-dynamic';

export default async function AdminHomepageMediaPage() {
  const [mediaRows, galleryRows] = await Promise.all([
    db.select().from(homepageMedia),
    db.query.galleryImages.findMany({
      orderBy: [asc(galleryImages.displayOrder), asc(galleryImages.createdAt)],
    }),
  ]);

  const media = {
    hero: mediaRows.find((r) => r.slot === 'hero') ?? null,
    editorial: mediaRows.find((r) => r.slot === 'editorial') ?? null,
  };

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
        initialGallery={galleryRows}
      />
    </div>
  );
}
