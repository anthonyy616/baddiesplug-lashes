import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { homepageMedia } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  isStorageConfigured,
  uploadToR2WithCache,
  deleteFromR2,
  getPublicUrl,
  generateHomeMediaKey,
} from '@/lib/storage';
import { processImageToWebP, getImagePreset, type ImagePreset } from '@/lib/storage/image-processing';
import { requireAdminSession } from '@/lib/admin-auth';

/**
 * Homepage hero/editorial media management.
 *
 * POST   /api/admin/home-media          (multipart: slot, file, altText?)
 * DELETE /api/admin/home-media?slot=X
 * GET    /api/admin/home-media          (current slots for the manager UI)
 *
 * Every upload is re-encoded server-side to true WebP (accepts WEBP/JPG/PNG/
 * HEIC from any phone) and stored under a FRESH key (`home/<slot>/<uuid>.webp`),
 * so the immutable CDN/browser cache can never serve a stale image after a
 * replace. The old object is deleted from R2 after a successful replace.
 */

const SLOTS = new Set(['hero', 'editorial']);
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB — full-res phone photos can be large

function isImageType(type: string | null): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  if (t === 'image/webp' || t === 'image/jpeg' || t === 'image/png') return true;
  // iPhone/safari HEIC/HEIF variants
  return t.startsWith('image/') && (t.includes('heic') || t.includes('heif'));
}

function getTypeFromFilename(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  const map: Record<string, string> = {
    webp: 'image/webp',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  return map[ext] ?? null;
}

export async function GET() {
  try {
    await requireAdminSession();

    const rows = await db.select().from(homepageMedia);
    const media = {
      hero: rows.find((r) => r.slot === 'hero') ?? null,
      editorial: rows.find((r) => r.slot === 'editorial') ?? null,
    };

    return NextResponse.json({ media });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Home media GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession();

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'Image storage is not configured (missing R2 env vars)' },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const slot = form.get('slot') as string | null;
    const file = form.get('file') as File | null;
    const altText = (form.get('altText') as string | null)?.trim().slice(0, 255) || null;

    if (!slot || !SLOTS.has(slot)) {
      return NextResponse.json({ error: 'slot must be hero or editorial' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const declared = file.type || getTypeFromFilename(file.name);
    if (!isImageType(declared) && !isImageType(getTypeFromFilename(file.name))) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload WEBP, JPG, PNG, or HEIC.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Image must be under ${MAX_BYTES / 1024 / 1024} MB` },
        { status: 400 }
      );
    }

    // Re-encode to true WebP at the hero/editorial quality preset (2560px / q90).
    let processed;
    try {
      processed = await processImageToWebP(
        Buffer.from(await file.arrayBuffer()),
        getImagePreset(slot as ImagePreset)
      );
    } catch {
      return NextResponse.json(
        { error: 'This file could not be processed as an image. Please upload a valid WEBP, JPG, PNG, or HEIC.' },
        { status: 400 }
      );
    }

    const mediaId = uuidv4();
    const storageKey = generateHomeMediaKey(slot, mediaId);
    const uploadResult = await uploadToR2WithCache(
      processed.buffer,
      storageKey,
      processed.contentType,
      true // public, immutable long-cache
    );

    if (!uploadResult.success) {
      return NextResponse.json({ error: uploadResult.error || 'Upload failed' }, { status: 500 });
    }

    const publicUrl = getPublicUrl(storageKey);

    // Replace any existing row for this slot (fresh key ⇒ cache-safe).
    const [existing] = await db
      .select()
      .from(homepageMedia)
      .where(eq(homepageMedia.slot, slot));

    const [row] = await db
      .insert(homepageMedia)
      .values({
        slot,
        storageKey,
        publicUrl,
        altText,
        width: processed.width,
        height: processed.height,
        uploadedBy: admin,
      })
      .onConflictDoUpdate({
        target: homepageMedia.slot,
        set: {
          storageKey,
          publicUrl,
          altText,
          width: processed.width,
          height: processed.height,
          uploadedBy: admin,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Delete the replaced object from R2 AFTER the DB row points at the new key.
    if (existing && existing.storageKey !== storageKey) {
      const r2 = await deleteFromR2(existing.storageKey);
      if (!r2.success) {
        console.error('Failed to delete replaced home media from R2:', existing.storageKey, r2.error);
      }
    }

    return NextResponse.json({ success: true, media: row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Home media POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminSession();

    const body = (await request.json()) as { slot?: string; altText?: string };
    const slot = body.slot;
    if (!slot || !SLOTS.has(slot)) {
      return NextResponse.json({ error: 'slot must be hero or editorial' }, { status: 400 });
    }

    const [updated] = await db
      .update(homepageMedia)
      .set({
        altText: body.altText?.trim().slice(0, 255) || null,
        updatedAt: new Date(),
      })
      .where(eq(homepageMedia.slot, slot))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'No image set for this slot' }, { status: 404 });
    }

    return NextResponse.json({ success: true, media: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Home media PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminSession();

    const slot = request.nextUrl.searchParams.get('slot');
    if (!slot || !SLOTS.has(slot)) {
      return NextResponse.json({ error: 'slot must be hero or editorial' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(homepageMedia)
      .where(eq(homepageMedia.slot, slot));

    if (!existing) {
      return NextResponse.json({ error: 'No image set for this slot' }, { status: 404 });
    }

    const r2 = await deleteFromR2(existing.storageKey);
    if (!r2.success) {
      console.error('Failed to delete home media from R2:', existing.storageKey, r2.error);
    }

    await db.delete(homepageMedia).where(eq(homepageMedia.slot, slot));

    return NextResponse.json({
      success: true,
      r2Deleted: r2.success,
      warning: r2.success ? undefined : 'DB row removed but R2 deletion failed — check R2 console',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Home media DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
