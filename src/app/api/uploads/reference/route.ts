import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { referenceImages, bookings } from '@/lib/db/schema';
import { eq, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '@/lib/auth/types';
import {
  uploadToR2,
  generateReferenceImageKey,
  isStorageConfigured,
} from '@/lib/storage';
import { validateFileName, validateFileSize, validateMimeType } from '@/lib/validation';

const MAX_IMAGES = 3;
const MAX_SIZE = 6 * 1024 * 1024; // 6 MB

const metadataSchema = z.object({
  bookingId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'Image storage is not configured. Please contact support.' },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const bookingId = String(formData.get('bookingId') || '');
    const file = formData.get('file');

    const parsed = metadataSchema.safeParse({ bookingId });
    if (!parsed.success || !(file instanceof File)) {
      return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 });
    }

    // Ownership check
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });
    if (!booking || booking.customerId !== user.id) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Validate file
    if (!validateFileSize(file.size)) {
      return NextResponse.json({ error: 'Image must be 6 MB or smaller.' }, { status: 400 });
    }
    if (!validateMimeType(file.type) || !validateFileName(file.name)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, WEBP, and HEIC images are allowed.' },
        { status: 400 }
      );
    }

    // Enforce max images per booking
    const [{ value: existingCount }] = await db
      .select({ value: count() })
      .from(referenceImages)
      .where(eq(referenceImages.bookingId, bookingId));

    if (existingCount >= MAX_IMAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES} reference photos per booking.` },
        { status: 400 }
      );
    }

    const imageId = uuidv4();
    const storageKey = generateReferenceImageKey(bookingId, imageId);
    const buffer = Buffer.from(await file.arrayBuffer());

    const upload = await uploadToR2(buffer, storageKey, file.type);
    if (!upload.success) {
      return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
    }

    // Retention: 1 month
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [record] = await db
      .insert(referenceImages)
      .values({
        id: imageId,
        bookingId,
        storageKey,
        originalFilename: file.name.slice(0, 255),
        mimeType: file.type,
        sizeBytes: file.size,
        expiresAt,
      })
      .returning();

    return NextResponse.json({
      success: true,
      image: {
        id: record.id,
        originalFilename: record.originalFilename,
        sizeBytes: record.sizeBytes,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Reference upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
