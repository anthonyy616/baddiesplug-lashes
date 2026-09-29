import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { beforeAfterGallery, bookings, services } from '@/lib/db/schema';
import { asc, eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  isStorageConfigured,
  uploadToR2WithCache,
  deleteFromR2,
  getPublicUrl,
  generateBeforeAfterKey,
} from '@/lib/storage';
import { processImageToWebP, getImagePreset } from '@/lib/storage/image-processing';
import { requireAdminSession } from '@/lib/admin-auth';
import { getBeforeAfterEntries, isCompletedBooking } from '@/lib/before-after';

/**
 * Before/after client gallery (Stage 6) — admin management.
 *
 * GET    /api/admin/before-after           (all entries, any visibility)
 * POST   /api/admin/before-after           (multipart: beforeFile, afterFile, ...)
 * PATCH  /api/admin/before-after           (JSON edits incl. publication/consent/reorder)
 * DELETE /api/admin/before-after?id=X      (removes row + both R2 objects)
 *
 * Reuses the existing R2 + Sharp pipeline: both images are re-encoded to true
 * WebP (gallery preset) under fresh keys so the immutable cache never serves
 * stale pairs. CONSENT RULE: entries start UNPUBLISHED (`isPublic=false`);
 * publication requires `clientConsent=true` — visibility is never implied by
 * an upload.
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
  const rows = await db
    .select({ order: beforeAfterGallery.displayOrder })
    .from(beforeAfterGallery);
  return rows.reduce((mx, r) => Math.max(mx, r.order), -1) + 1;
}

export async function GET() {
  try {
    await requireAdminSession();

    const entries = await getBeforeAfterEntries();
    const serviceRows = await db
      .select({ id: services.id, name: services.name, category: services.category })
      .from(services)
      .where(and(eq(services.isActive, true), isNull(services.deletedAt)))
      .orderBy(asc(services.category), asc(services.name));

    return NextResponse.json({ entries, services: serviceRows });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Before-after GET error:', error);
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
    const beforeFile = form.get('beforeFile') as File | null;
    const afterFile = form.get('afterFile') as File | null;
    const caption = (form.get('caption') as string | null)?.trim().slice(0, 120) || null;
    const altText = (form.get('altText') as string | null)?.trim().slice(0, 255) || null;
    const serviceId = (form.get('serviceId') as string | null)?.trim() || null;
    const bookingId = (form.get('bookingId') as string | null)?.trim() || null;
    // Consent + publication: default to the SAFE state (unpublished, no
    // consent) unless the admin explicitly records consent.
    const clientConsent = form.get('clientConsent') === 'true';
    const requestedPublic = form.get('isPublic') === 'true';
    // Publication requires recorded consent — visibility is never implied.
    const isPublic = requestedPublic && clientConsent;

    if (!beforeFile || !afterFile) {
      return NextResponse.json(
        { error: 'Both before and after images are required' },
        { status: 400 }
      );
    }

    for (const file of [beforeFile, afterFile]) {
      const declared = file.type || getTypeFromFilename(file.name);
      if (!isImageType(declared) && !isImageType(getTypeFromFilename(file.name))) {
        return NextResponse.json(
          { error: 'Unsupported file type. Upload WEBP, JPG, PNG, or HEIC.' },
          { status: 400 }
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `Images must be under ${MAX_BYTES / 1024 / 1024} MB` },
          { status: 400 }
        );
      }
    }

    // Service assignment must reference an active catalogue service.
    if (serviceId) {
      const [service] = await db
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.id, serviceId), eq(services.isActive, true), isNull(services.deletedAt)));
      if (!service) {
        return NextResponse.json({ error: 'Service not found or inactive' }, { status: 400 });
      }
    }

    // Booking association is allowed only for COMPLETED bookings, and only
    // records the link — private booking reference images never become media.
    if (bookingId && !(await isCompletedBooking(bookingId))) {
      return NextResponse.json(
        { error: 'Only completed bookings can be associated with a gallery entry' },
        { status: 400 }
      );
    }

    const process = async (file: File) =>
      processImageToWebP(Buffer.from(await file.arrayBuffer()), getImagePreset('gallery'));

    let beforeProcessed;
    let afterProcessed;
    try {
      [beforeProcessed, afterProcessed] = await Promise.all([process(beforeFile), process(afterFile)]);
    } catch {
      return NextResponse.json(
        { error: 'One of the files could not be processed as an image. Please upload valid WEBP, JPG, PNG, or HEIC.' },
        { status: 400 }
      );
    }

    const entryId = uuidv4();
    const beforeKey = generateBeforeAfterKey(entryId, 'before');
    const afterKey = generateBeforeAfterKey(entryId, 'after');

    const [beforeUpload, afterUpload] = await Promise.all([
      uploadToR2WithCache(beforeProcessed.buffer, beforeKey, beforeProcessed.contentType, true),
      uploadToR2WithCache(afterProcessed.buffer, afterKey, afterProcessed.contentType, true),
    ]);

    if (!beforeUpload.success) {
      return NextResponse.json({ error: beforeUpload.error || 'Before image upload failed' }, { status: 500 });
    }
    if (!afterUpload.success) {
      // Best-effort cleanup of the first upload so we never orphan objects.
      await deleteFromR2(beforeKey);
      return NextResponse.json({ error: afterUpload.error || 'After image upload failed' }, { status: 500 });
    }

    const displayOrder = await getNextDisplayOrder();

    const [row] = await db
      .insert(beforeAfterGallery)
      .values({
        id: entryId,
        beforeStorageKey: beforeKey,
        beforePublicUrl: getPublicUrl(beforeKey),
        beforeWidth: beforeProcessed.width,
        beforeHeight: beforeProcessed.height,
        afterStorageKey: afterKey,
        afterPublicUrl: getPublicUrl(afterKey),
        afterWidth: afterProcessed.width,
        afterHeight: afterProcessed.height,
        serviceId,
        bookingId,
        caption,
        altText: altText ?? caption,
        isPublic,
        clientConsent,
        displayOrder,
        uploadedBy: admin,
      })
      .returning();

    return NextResponse.json({ success: true, entry: row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Before-after POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminSession();

    const body = (await request.json()) as {
      id?: string;
      serviceId?: string | null;
      bookingId?: string | null;
      caption?: string | null;
      altText?: string | null;
      displayOrder?: number;
      isPublic?: boolean;
      clientConsent?: boolean;
    };

    if (!body.id || !/^[0-9a-f-]{36}$/i.test(body.id)) {
      return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(beforeAfterGallery)
      .where(eq(beforeAfterGallery.id, body.id));
    if (!existing) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.serviceId !== undefined) {
      if (body.serviceId !== null && !/^[0-9a-f-]{36}$/i.test(body.serviceId)) {
        return NextResponse.json({ error: 'Invalid serviceId' }, { status: 400 });
      }
      if (body.serviceId) {
        const [service] = await db
          .select({ id: services.id })
          .from(services)
          .where(and(eq(services.id, body.serviceId), eq(services.isActive, true), isNull(services.deletedAt)));
        if (!service) return NextResponse.json({ error: 'Service not found or inactive' }, { status: 400 });
      }
      updates.serviceId = body.serviceId;
    }

    if (body.bookingId !== undefined) {
      if (body.bookingId !== null && !/^[0-9a-f-]{36}$/i.test(body.bookingId)) {
        return NextResponse.json({ error: 'Invalid bookingId' }, { status: 400 });
      }
      if (body.bookingId && !(await isCompletedBooking(body.bookingId))) {
        return NextResponse.json(
          { error: 'Only completed bookings can be associated with a gallery entry' },
          { status: 400 }
        );
      }
      updates.bookingId = body.bookingId;
    }

    if (body.caption !== undefined) {
      updates.caption = body.caption?.trim().slice(0, 120) || null;
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

    // CONSENT/PUBLICATION GUARD: visibility can only be true when consent is
    // recorded. Revoking consent unpublishes; uploading never publishes.
    if (body.clientConsent !== undefined) {
      updates.clientConsent = Boolean(body.clientConsent);
    }
    if (body.isPublic !== undefined) {
      const consent = updates.clientConsent !== undefined
        ? Boolean(updates.clientConsent)
        : existing.clientConsent;
      updates.isPublic = Boolean(body.isPublic) && consent;
    } else if (updates.clientConsent === false) {
      // Consent revoked -> must unpublish.
      updates.isPublic = false;
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(beforeAfterGallery)
      .set(updates)
      .where(eq(beforeAfterGallery.id, body.id))
      .returning();

    return NextResponse.json({ success: true, entry: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Before-after PATCH error:', error);
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

    const [entry] = await db.select().from(beforeAfterGallery).where(eq(beforeAfterGallery.id, id));
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Remove both R2 objects (best-effort) then the row, mirroring the
    // existing gallery deletion logic.
    await deleteFromR2(entry.beforeStorageKey);
    await deleteFromR2(entry.afterStorageKey);
    await db.delete(beforeAfterGallery).where(eq(beforeAfterGallery.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Before-after DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
