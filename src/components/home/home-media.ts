import 'server-only';
import { db } from '@/lib/db';
import { homepageMedia, galleryImages } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import { HOME_IMAGES } from './site';

/**
 * Server-side loader for admin-managed homepage imagery.
 *
 * Source of truth is the DB (uploaded from /admin/homepage). Until the admin
 * uploads, the static R2 keys from site.ts act as fallbacks — which render as
 * branded placeholders when the objects don't exist yet (SmartImage).
 *
 * Homepage is `force-dynamic`, so admin uploads appear on the very next page
 * view with zero cache invalidation (fresh UUID keys ⇒ CDN never serves stale).
 */

export interface HomeMedia {
  src: string;
  alt: string;
}

export interface GalleryImage {
  src: string;
  alt: string;
  caption: string | null;
}

export async function getHeroImage(): Promise<HomeMedia> {
  const [row] = await db
    .select()
    .from(homepageMedia)
    .where(eq(homepageMedia.slot, 'hero'));

  if (row) {
    return { src: row.publicUrl, alt: row.altText ?? HOME_IMAGES.hero.alt };
  }
  return { src: HOME_IMAGES.hero.src, alt: HOME_IMAGES.hero.alt };
}

export async function getEditorialImage(): Promise<HomeMedia> {
  const [row] = await db
    .select()
    .from(homepageMedia)
    .where(eq(homepageMedia.slot, 'editorial'));

  if (row) {
    return { src: row.publicUrl, alt: row.altText ?? HOME_IMAGES.editorial.alt };
  }
  return { src: HOME_IMAGES.editorial.src, alt: HOME_IMAGES.editorial.alt };
}

/**
 * Admin gallery images in display order. When nothing has been uploaded yet,
 * the static keys from site.ts keep the editorial layout intact (placeholders).
 */
export async function getGalleryImages(limit = 6): Promise<GalleryImage[]> {
  const rows = await db.query.galleryImages.findMany({
    orderBy: [asc(galleryImages.displayOrder), asc(galleryImages.createdAt)],
  });

  if (rows.length === 0) {
    return HOME_IMAGES.gallery.slice(0, limit).map((src) => ({
      src,
      alt: 'Lash work by The Baddies Plug',
      caption: null,
    }));
  }

  const images = rows.slice(0, limit).map((row) => ({
    src: row.publicUrl,
    alt: row.altText ?? row.caption ?? 'Lash work by The Baddies Plug',
    caption: row.caption,
  }));

  // Pad with static fallback keys when the admin hasn't filled the grid yet —
  // those render as branded placeholders and keep the layout editorial.
  while (images.length < limit) {
    const src = HOME_IMAGES.gallery[images.length];
    if (!src) break;
    images.push({ src, alt: 'Lash work by The Baddies Plug', caption: null });
  }

  return images;
}
