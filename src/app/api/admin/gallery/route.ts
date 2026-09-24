import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { galleryImages } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  isStorageConfigured,
  uploadToR2WithCache,
  deleteFromR2,
  getPublicUrl,
  generateGalleryImageKey,
} from '@/lib/storage';
import { processImageToWebP, getImagePreset } from '@/lib/storage/image-processing';
import { requireAdminSession } from '@/lib/admin-auth';

/**
 * Admin-managed homepage work gallery.
 *
 * GET    /api/admin/gallery                 (all images in display order)
 * POST   /api/admin/gallery                 (multipart: file, caption?, altText?)
 * PATCH  /api/admin/gallery                 (JSON: { id, caption?, altText?, displayOrder? })
 * DELETE /api/admin/gallery?id=X
 *
 * Uploads accept WEBP/JPG/PNG/HEIC from any phone and are re-encoded server-
 * side to true WebP (2000px / q85) under a fresh key (`gallery/<uuid>.webp`),
 * so the immutable CDN/browser cache never serves a stale image.
 */

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

function isImageType(type: string | null): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  if (t === 'image/webp' || t === 'image/jpeg' || t === 'image/png') return true;
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

async function getNextDisplayOrder(): Promise<number> {
  const rows = await db.select({ order: galleryImages.displayOrder }).from(galleryImages);
  return rows.reduce((mx, r) => Math.max(mx, r.order), -1) + 1;
}

export async function GET() {
  try {
    await requireAdminSession();

    const images = await db.query.galleryImages.findMany({
      orderBy: [asc(galleryImages.displayOrder), asc(galleryImages.createdAt)],
    });

    return NextResponse.json({ images });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Gallery GET error:', error);
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
    const file = form.get('file') as File | null;
    const caption = (form.get('caption') as string | null)?.trim().slice(0, 120) || null;
    const altText = (form.get('altText') as string | null)?.trim().slice(0, 255) || null;

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

    // Re-encode to true WebP at the gallery preset (2000px / q85).
    let processed;
    try {
      processed = await processImageToWebP(
        Buffer.from(await file.arrayBuffer()),
        getImagePreset('gallery')
      );
    } catch {
      return NextResponse.json(
        { error: 'This file could not be processed as an image. Please upload a valid WEBP, JPG, PNG, or HEIC.' },
        { status: 400 }
      );
    }

    const imageId = uuidv4();
    const storageKey = generateGalleryImageKey(imageId);
    const uploadResult = await uploadToR2WithCache(
      processed.buffer,
      storageKey,
      processed.contentType,
      true
    );

    if (!uploadResult.success) {
      return NextResponse.json({ error: uploadResult.error || 'Upload failed' }, { status: 500 });
    }

    const displayOrder = await getNextDisplayOrder();

    const [row] = await db
      .insert(galleryImages)
      .values({
        id: imageId,
        storageKey,
        publicUrl: getPublicUrl(storageKey),
        caption,
        altText: altText ?? caption,
        displayOrder,
        width: processed.width,
        height: processed.height,
        uploadedBy: admin,
      })
      .returning();

    return NextResponse.json({ success: true, image: row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Gallery POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminSession();

    const body = (await request.json()) as {
      id?: string;
      caption?: string | null;
      altText?: string | null;
      displayOrder?: number;
    };

    if (!body.id || !/^[0-9a-f-]{36}$/i.test(body.id)) {
      return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.caption !== undefined) {
      updates.caption = body.caption?.trim().slice(0, 120) || null;
      // Keep alt text in sync when it was only mirroring the caption.
      if (body.altText === undefined) updates.altText = updates.caption;
    }
    if (body.altText !== undefined) {
      updates.altText = body.altText?.trim().slice(0, 255) || null;
    }
    if (body.displayOrder !== undefined) {
      if (!Number.isInteger(body.displayOrder)) {
        return NextResponse.json({ error: 'displayOrder must be an integer' }, { status: 400 });
      }
      updates.displayOrder = body.displayOrder;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(galleryImages)
      .set(updates)
      .where(eq(galleryImages.id, body.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, image: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Gallery PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminSession();

    const id = request.nextUrl.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 });
    }

    const [image] = await db.select().from(galleryImages).where(eq(galleryImages.id, id));
    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const r2 = await deleteFromR2(image.storageKey);
    if (!r2.success) {
      console.error('R2 delete failed for gallery image', image.id, r2.error);
    }

    await db.delete(galleryImages).where(eq(galleryImages.id, id));

    return NextResponse.json({
      success: true,
      r2Deleted: r2.success,
      warning: r2.success ? undefined : 'Image row removed but R2 deletion failed — check R2 console',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Gallery DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
