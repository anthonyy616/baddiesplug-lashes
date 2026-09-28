import 'server-only';
import { db } from '@/lib/db';
import { galleryCategoryOrder, galleryImages, homepageMedia, services } from '@/lib/db/schema';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
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

export interface GalleryViewImage extends GalleryImage {
  id: string;
}

export interface GalleryViewService {
  id: string;
  name: string;
  slug: string;
  category: string;
  images: GalleryViewImage[];
}

export interface GalleryViewCategory {
  name: string;
  services: GalleryViewService[];
}

export async function getHeroImage(): Promise<HomeMedia> {
  let row: typeof homepageMedia.$inferSelect | undefined;

  try {
    [row] = await db
      .select()
      .from(homepageMedia)
      .where(eq(homepageMedia.slot, 'hero'));
  } catch (error) {
    console.error('Hero media query failed; using static fallback:', error);
  }

  if (row) {
    return { src: row.publicUrl, alt: row.altText ?? HOME_IMAGES.hero.alt };
  }
  return { src: HOME_IMAGES.hero.src, alt: HOME_IMAGES.hero.alt };
}

export async function getEditorialImage(): Promise<HomeMedia> {
  let row: typeof homepageMedia.$inferSelect | undefined;

  try {
    [row] = await db
      .select()
      .from(homepageMedia)
      .where(eq(homepageMedia.slot, 'editorial'));
  } catch (error) {
    console.error('Editorial media query failed; using static fallback:', error);
  }

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
  let rows: Awaited<ReturnType<typeof db.query.galleryImages.findMany>> = [];

  try {
    rows = await db.query.galleryImages.findMany({
      orderBy: [asc(galleryImages.displayOrder), asc(galleryImages.createdAt)],
    });
  } catch (error) {
    // Keep the public homepage available while a deployment is waiting for
    // the optional admin-media migration to reach its database.
    console.error('Gallery media query failed; using static fallback:', error);
  }

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

/** All homepage gallery images grouped by configurable category and service order. */
export async function getGalleryViewData(): Promise<GalleryViewCategory[]> {
  const rows = await db
    .select({
      image: galleryImages,
      service: services,
      categoryOrder: galleryCategoryOrder,
    })
    .from(galleryImages)
    .leftJoin(services, eq(galleryImages.serviceId, services.id))
    .leftJoin(galleryCategoryOrder, eq(services.category, galleryCategoryOrder.category))
    .where(or(
      isNull(galleryImages.serviceId),
      and(eq(services.isActive, true), isNull(services.deletedAt)),
    ))
    .orderBy(
      asc(galleryCategoryOrder.displayOrder),
      asc(services.category),
      asc(services.displayOrder),
      asc(services.name),
      asc(galleryImages.displayOrder),
      asc(galleryImages.createdAt),
    );

  const categoryMap = new Map<string, GalleryViewCategory>();
  const serviceMap = new Map<string, GalleryViewService>();

  for (const row of rows) {
    const categoryName = row.service?.category ?? 'Unassigned';
    let category = categoryMap.get(categoryName);
    if (!category) {
      category = { name: categoryName, services: [] };
      categoryMap.set(categoryName, category);
    }

    if (!row.service) {
      let unassigned = category.services[0];
      if (!unassigned) {
        unassigned = {
          id: 'unassigned',
          name: 'Unassigned images',
          slug: 'unassigned',
          category: categoryName,
          images: [],
        };
        category.services.push(unassigned);
      }
      unassigned.images.push({
        id: row.image.id,
        src: row.image.publicUrl,
        alt: row.image.altText ?? row.image.caption ?? 'Lash work by The Baddies Plug',
        caption: row.image.caption,
      });
      continue;
    }

    let service = serviceMap.get(row.service.id);
    if (!service) {
      service = {
        id: row.service.id,
        name: row.service.name,
        slug: row.service.slug,
        category: row.service.category,
        images: [],
      };
      serviceMap.set(row.service.id, service);
      category.services.push(service);
    }
    service.images.push({
      id: row.image.id,
      src: row.image.publicUrl,
      alt: row.image.altText ?? row.image.caption ?? row.service.name,
      caption: row.image.caption,
    });
  }

  return Array.from(categoryMap.values());
}
