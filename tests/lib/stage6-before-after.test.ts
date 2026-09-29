import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('before/after gallery migration (Stage 6)', () => {
  it('0015 migration exists and is registered in the journal after 0014', () => {
    const sql = read('db/migrations/0015_before_after_gallery.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "before_after_gallery"');
    const journal = JSON.parse(read('db/migrations/meta/_journal.json'));
    const tags = journal.entries.map((e: { tag: string }) => e.tag);
    expect(tags.indexOf('0015_before_after_gallery')).toBeGreaterThan(tags.indexOf('0014_favourite_services'));
  });

  it('publication starts false — never public just because it was uploaded', () => {
    const sql = read('db/migrations/0015_before_after_gallery.sql');
    expect(sql).toMatch(/"is_public" boolean NOT NULL DEFAULT false/);
    expect(sql).toMatch(/"client_consent" boolean NOT NULL DEFAULT false/);
  });

  it('does not expose private booking reference images as gallery media', () => {
    const storage = read('src/lib/storage/index.ts');
    // Separate key space for the pair; reference keys stay under reference/.
    expect(storage).toContain('generateBeforeAfterKey');
    expect(storage).toContain('gallery/before-after/');
    const refIdx = storage.indexOf('generateReferenceImageKey');
    expect(refIdx).toBeGreaterThan(-1);
    // Private booking references live in their own key space, distinct from
    // the before/after key space.
    expect(storage.slice(refIdx, refIdx + 300)).not.toContain('before-after');
  });

  it('forward-only migration style (IF NOT EXISTS / DO $$ FK guards)', () => {
    const sql = read('db/migrations/0015_before_after_gallery.sql');
    expect(sql).toContain('DO $$');
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE/i);
  });
});

describe('before/after domain rules (Stage 6)', () => {
  it('public reads filter strictly on isPublic', () => {
    const src = read('src/lib/before-after/index.ts');
    expect(src).toContain('export async function getPublicBeforeAfterEntries');
    const fnIdx = src.indexOf('export async function getPublicBeforeAfterEntries');
    const fnBody = src.slice(fnIdx, fnIdx + 700);
    expect(fnBody).toContain('eq(beforeAfterGallery.isPublic, true)');
  });

  it('admin reads return all entries (drafts included)', () => {
    const src = read('src/lib/before-after/index.ts');
    expect(src).toContain('export async function getBeforeAfterEntries');
    const fnIdx = src.indexOf('export async function getBeforeAfterEntries');
    const fnBody = src.slice(fnIdx, src.indexOf('export async function getPublicBeforeAfterEntries'));
    expect(fnBody).not.toContain('isPublic, true');
  });

  it('booking association allowed only for completed bookings', () => {
    const src = read('src/lib/before-after/index.ts');
    expect(src).toMatch(/status === 'completed'/);
  });

  it('publication requires recorded consent', () => {
    const src = read('src/lib/before-after/index.ts');
    expect(src).toMatch(/canPublish/);
    expect(src).toMatch(/input\.isPublic && input\.clientConsent/);
  });
});

describe('before/after API consent guards (Stage 6)', () => {
  it('upload defaults to the safe state: unpublished without consent', () => {
    const src = read('src/app/api/admin/before-after/route.ts');
    const postIdx = src.indexOf('export async function POST');
    const postBody = src.slice(postIdx, src.indexOf('export async function PATCH'));
    expect(postBody).toMatch(/isPublic = requestedPublic && clientConsent/);
  });

  it('PATCH cannot publish without consent; revoking consent unpublishes', () => {
    const src = read('src/app/api/admin/before-after/route.ts');
    expect(src).toMatch(/updates\.isPublic = Boolean\(body\.isPublic\) && consent/);
    expect(src).toMatch(/updates\.clientConsent === false[\s\S]{0,200}updates\.isPublic = false/);
  });

  it('rejects booking association for non-completed bookings', () => {
    const src = read('src/app/api/admin/before-after/route.ts');
    expect(src).toMatch(/Only completed bookings can be associated with a gallery entry/);
  });

  it('deletes both R2 objects on entry delete (reuses storage deletion logic)', () => {
    const src = read('src/app/api/admin/before-after/route.ts');
    const deleteIdx = src.indexOf('export async function DELETE');
    const deleteBody = src.slice(deleteIdx);
    expect(deleteBody).toContain('deleteFromR2(entry.beforeStorageKey)');
    expect(deleteBody).toContain('deleteFromR2(entry.afterStorageKey)');
  });

  it('reuses the R2 upload + Sharp WebP pipeline', () => {
    const src = read('src/app/api/admin/before-after/route.ts');
    expect(src).toContain('uploadToR2WithCache');
    expect(src).toContain('processImageToWebP');
    expect(src).toContain("getImagePreset('gallery')");
  });
});

describe('before/after UI (Stage 6)', () => {
  it('public showcase renders only server-filtered entries', () => {
    const src = read('src/components/gallery/BeforeAfterShowcase.tsx');
    expect(src).toContain('entries: BeforeAfterEntry[]');
    expect(src).toContain('entry.beforePublicUrl');
    expect(src).toContain('entry.afterPublicUrl');
    // The component performs no filtering of its own (server pre-filters);
    // it documents that it renders only isPublic entries.
    expect(src).toMatch(/ONLY entries already\s*\n\s*\* filtered/);
  });

  it('gallery-view page mounts the public showcase', () => {
    const src = read('src/app/gallery-view/page.tsx');
    expect(src).toContain('getPublicBeforeAfterEntries');
    expect(src).toContain('BeforeAfterShowcase');
  });

  it('admin manager exposes consent + publication + reorder + delete', () => {
    const src = read('src/app/admin/before-after/BeforeAfterManager.tsx');
    expect(src).toContain('Record consent');
    expect(src).toContain('Publish');
    expect(src).toContain('displayOrder');
    expect(src).toContain('handleDelete');
  });

  it('admin page states the never-auto-public rule', () => {
    const src = read('src/app/admin/before-after/page.tsx');
    expect(src).toMatch(/never public just because/i);
  });

  it('nav includes the manager entry', () => {
    const src = read('src/components/admin/AdminNav.tsx');
    expect(src).toContain("href: '/admin/before-after'");
  });

  it('schema and types are wired', () => {
    const schema = read('src/lib/db/schema/index.ts');
    expect(schema).toContain('export const beforeAfterGallery');
    expect(schema).toContain('beforeAfterGalleryRelations');
    const types = read('src/types/index.ts');
    expect(types).toContain('export interface BeforeAfterEntry');
    expect(types).toContain('clientConsent: boolean');
  });
});
