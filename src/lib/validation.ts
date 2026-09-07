import { z } from 'zod';

export const bookingDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

export const slotSchema = z.object({
  date: bookingDateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
});

export const phoneSchema = z.string().min(10).max(15);

export const notesSchema = z.string().max(1000).optional();

export const serviceIdsSchema = z.array(z.string().uuid()).min(1);

export const addonIdsSchema = z.array(z.string().uuid());

export const createBookingSchema = z.object({
  serviceIds: serviceIdsSchema,
  addonIds: addonIdsSchema,
  date: bookingDateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  phone: phoneSchema,
  notes: notesSchema,
});

export const bookingIdSchema = z.string().uuid();

export const uuidSchema = z.string().uuid();

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

export function validateFileName(filename: string): boolean {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return allowedExtensions.includes(ext);
}

export function validateFileSize(sizeBytes: number): boolean {
  const maxSizeBytes = 6 * 1024 * 1024; // 6 MB
  return sizeBytes <= maxSizeBytes;
}

export function validateMimeType(mimeType: string): boolean {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
  ];
  return allowedMimeTypes.includes(mimeType);
}

export function validateImageCount(count: number): boolean {
  return count <= 3;
}
