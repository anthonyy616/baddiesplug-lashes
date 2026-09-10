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
import { createBooking } from '@/lib/booking';
import { headers } from 'next/headers';

const MAX_IMAGES = 3;
const MAX_SIZE = 6 * 1024 * 1024; // 6 MB

const bookingIdSchema = z.string().uuid().optional().or(z.literal(''));
const metadataSchema = z.object({
  bookingId: bookingIdSchema,
  serviceIds: z.string().optional(),
  addonIds: z.string().optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'Image storage is not configured. Please contact support.' },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const bookingIdRaw = String(formData.get('bookingId') || '');
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 });
    }

    // Validate file before anything else
    if (!validateFileSize(file.size)) {
      return NextResponse.json({ error: 'Image must be 6 MB or smaller.' }, { status: 400 });
    }
    if (!validateMimeType(file.type) || !validateFileName(file.name)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, WEBP, and HEIC images are allowed.' },
        { status: 400 },
      );
    }

    let bookingId = bookingIdRaw || '';

    // If no bookingId provided, create one from the form data
    if (!bookingId) {
      const serviceIds = String(formData.get('serviceIds') || '');
      const addonIds = String(formData.get('addonIds') || '');
      const date = String(formData.get('date') || '');
      const startTime = String(formData.get('startTime') || '');
      const endTime = String(formData.get('endTime') || '');
      const phone = String(formData.get('phone') || '');
      const notes = String(formData.get('notes') || '');

      // We need at least service IDs, date, start/end time, and phone to create a booking
      if (!serviceIds || !date || !startTime || !endTime || !phone) {
        return NextResponse.json(
          { error: 'Booking details required to create a booking for reference upload.' },
          { status: 400 },
        );
      }

      const result = await createBooking(
        serviceIds.split(',').filter(Boolean),
        addonIds.split(',').filter(Boolean),
        date,
        startTime,
        endTime,
        phone,
        notes || undefined,
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to create booking for reference upload.' },
          { status: 400 },
        );
      }

      bookingId = result.bookingId!;
    }

    // Ownership check
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });
    if (!booking || booking.customerId !== user.id) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Enforce max images per booking
    const [{ value: existingCount }] = await db
      .select({ value: count() })
      .from(referenceImages)
      .where(eq(referenceImages.bookingId, bookingId));

    if (existingCount >= MAX_IMAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES} reference photos per booking.` },
        { status: 400 },
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
      bookingId: bookingId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Reference upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
