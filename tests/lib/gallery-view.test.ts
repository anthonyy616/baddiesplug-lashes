import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('public gallery view', () => {
  it('has a public gallery-view route', () => {
    const page = read('src/app/gallery-view/page.tsx');
    expect(page).toContain('getGalleryViewData');
    expect(page).toContain('GalleryViewGrid');
  });

  it('makes homepage View affordances navigate to gallery-view', () => {
    const galleryTile = read('src/components/home/GalleryTile.tsx');
    const workGallery = read('src/components/home/WorkGallery.tsx');
    expect(galleryTile).toContain('href?: string');
    expect(galleryTile).toContain('<Link href={href}');
    expect(workGallery).toContain('href="/gallery-view/"');
  });

  it('groups homepage images by service and category order', () => {
    const loader = read('src/components/home/home-media.ts');
    expect(loader).toContain('getGalleryViewData');
    expect(loader).toContain('galleryCategoryOrder');
    expect(loader).toContain('services.displayOrder');
    expect(loader).toContain('galleryImages.displayOrder');
    expect(loader).toContain("'Unassigned'");
  });
});

describe('admin gallery categorization', () => {
  it('persists service assignment and category ordering', () => {
    const route = read('src/app/api/admin/gallery/route.ts');
    const schema = read('src/lib/db/schema/index.ts');
    expect(schema).toContain('serviceId: uuid(\'service_id\')');
    expect(schema).toContain('galleryCategoryOrder');
    expect(route).toContain('serviceId?: string | null');
    expect(route).toContain('categoryDisplayOrder?: number');
    expect(route).toContain('Service not found or inactive');
  });

  it('has a forward-only migration that preserves existing gallery rows', () => {
    const migration = read('db/migrations/0012_gallery_service_assignment.sql');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "service_id"');
    expect(migration).toContain('ON DELETE SET NULL');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "gallery_category_order"');
  });
});
