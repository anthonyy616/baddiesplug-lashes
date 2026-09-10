import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { services, serviceImages } from '@/lib/db/schema';
import { eq, asc, max } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  isStorageConfigured,
  uploadToR2WithCache,
  deleteFromR2,
  getPublicUrl,
  generateServiceImageKey,
} from '@/lib/storage';
import { requireAdminSession } from '@/lib/admin-auth';

const ALLOWED_TYPES = new Set([
  'image/webp',
  'image/jpeg',
  'image/png',
  'image/heif',
  'image/heic',
  // Safari sometimes reports heic/heif as image/heic or image/heif;
  // also accept image/hevc and image/x-heic as a safety net.
  'image/hevc',
  'image/x-heic',
  'image/x-heif',
]);

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

function isImageType(type: string | null): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  if (ALLOWED_TYPES.has(t)) return true;
  // Accept by extension-derived mime for HEIC/HEIF edge cases
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

async function getNextDisplayOrder(serviceId: string): Promise<number> {
  const rows = await db
    .select({ mx: max(serviceImages.displayOrder) })
    .from(serviceImages)
    .where(eq(serviceImages.serviceId, serviceId));
  return (rows[0]?.mx ?? -1) + 1;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession();

    const serviceId = request.nextUrl.searchParams.get('serviceId');
    if (!serviceId) {
      return NextResponse.json({ error: 'Missing serviceId' }, { status: 400 });
    }

    const images = await db.query.serviceImages.findMany({
      where: eq(serviceImages.serviceId, serviceId),
      orderBy: [asc(serviceImages.displayOrder)],
    });

    return NextResponse.json({ images });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Service images GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'Image storage is not configured (missing R2 env vars)' },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const file = form.get('file') as File | null;
    const serviceId = form.get('serviceId') as string | null;
    const altText = form.get('altText') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (!serviceId || !/^[0-9a-f-]{36}$/i.test(serviceId)) {
      return NextResponse.json({ error: 'Invalid or missing serviceId' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Image must be under ${MAX_BYTES / 1024 / 1024} MB` },
        { status: 400 }
      );
    }

    // Verify the service exists and is active
    const service = await db.query.services.findFirst({
      where: eq(services.id, serviceId),
    });
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }
    if (!service.isActive) {
      return NextResponse.json({ error: 'Cannot upload images for an inactive service' }, { status: 400 });
    }

    const clientMime = file.type;
    const extFromName = getTypeFromFilename(file.name);
    // Decide the stored type: prefer client type if it's an allowed image,
    // otherwise fall back to extension-derived type, otherwise reject.
    let resolvedMime: string;
    if (isImageType(clientMime)) {
      resolvedMime = clientMime;
    } else if (extFromName && isImageType(extFromName)) {
      resolvedMime = extFromName;
    } else {
      return NextResponse.json({ error: 'Image format not allowed (WEBP, JPG, PNG, HEIF, HEIC)' }, { status: 400 });
    }

    // Normalize HEIF/HEIC to a single stored mime so the public URL always
    // ends with .webp and the browser can display it. We store the actual
    // bytes as-is (R2 serves by ContentType), but the key uses .webp.
    const storageKey = generateServiceImageKey(serviceId, uuidv4());
    const uploadResult = await uploadToR2WithCache(
      Buffer.from(await file.arrayBuffer()),
      storageKey,
      resolvedMime,
      true // public, long-lived cache for first-display speed
    );

    if (!uploadResult.success) {
      return NextResponse.json({ error: uploadResult.error || 'Upload failed' }, { status: 500 });
    }

    const displayOrder = await getNextDisplayOrder(serviceId);

    const [row] = await db
      .insert(serviceImages)
      .values({
        id: uuidv4(),
        serviceId,
        storageKey,
        publicUrl: getPublicUrl(storageKey),
        altText: (altText ?? '').trim().slice(0, 255) || undefined,
        displayOrder,
      })
      .returning();

    return NextResponse.json({ success: true, image: row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Service images POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminSession();

    const id = request.nextUrl.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid or missing image id' }, { status: 400 });
    }

    const image = await db.query.serviceImages.findFirst({
      where: eq(serviceImages.id, id),
    });
    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Delete from R2. If it fails (e.g. transient S3 error), we still remove
    // the DB row so the admin UI never stalls on a malformed XML / network
    // error — the row is already orphaned and will be cleaned up by the image
    // cleanup job. We log the failure for manual follow-up.
    let r2Failed = false;
    try {
      const r2 = await deleteFromR2(image.storageKey);
      if (!r2.success) {
        r2Failed = true;
        console.error('R2 delete failed for service image', image.id, r2.error);
      }
    } catch (err) {
      r2Failed = true;
      console.error('R2 delete threw for service image', image.id, err);
    }

    await db.delete(serviceImages).where(eq(serviceImages.id, id));

    return NextResponse.json({
      success: true,
      r2Deleted: !r2Failed,
      warning: r2Failed ? 'Image row removed but R2 deletion failed — check R2 console' : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Service images DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
