import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 storage via the S3-compatible API.
 *
 * Env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET_NAME, R2_PUBLIC_URL (public base URL for service images).
 */

export interface UploadResult {
  key: string;
  url: string;
  success: boolean;
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      throw new Error('R2 storage is not configured (missing R2 env vars)');
    }
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

export function isStorageConfigured(): boolean {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}

/** Generate public URL for a storage key (service images). */
export function getPublicUrl(storageKey: string): string {
  return `${R2_PUBLIC_URL || ''}/${storageKey}`.replace(/([^:])\/\//g, '$1/');
}

/**
 * Upload a file to R2.
 */
export async function uploadToR2(
  buffer: Buffer,
  storageKey: string,
  contentType: string
): Promise<UploadResult> {
  return uploadToR2WithCache(buffer, storageKey, contentType, false);
}

/**
 * Upload a file to R2 with a public Cache-Control header.
 * Used for service images so the first display is cached at the CDN/browser.
 */
export async function uploadToR2WithCache(
  buffer: Buffer,
  storageKey: string,
  contentType: string,
  publicCache: boolean
): Promise<UploadResult> {
  try {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: storageKey,
        Body: buffer,
        ContentType: contentType,
        CacheControl: publicCache ? 'public, max-age=31536000, immutable' : undefined,
      })
    );

    return {
      key: storageKey,
      url: getPublicUrl(storageKey),
      success: true,
    };
  } catch (error) {
    console.error('R2 upload error:', error);
    return {
      key: storageKey,
      url: getPublicUrl(storageKey),
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Delete a file from R2.
 */
export async function deleteFromR2(storageKey: string): Promise<DeleteResult> {
  try {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: storageKey,
      })
    );
    return { success: true };
  } catch (error) {
    console.error('R2 delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Generate a short-lived signed URL for private objects (reference images).
 * Only the admin flow uses this — never expose publicly.
 */
export async function getSignedDownloadUrl(
  storageKey: string,
  expiresInSeconds = 900
): Promise<string> {
  const client = getS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storageKey }),
    { expiresIn: expiresInSeconds }
  );
}

/**
 * Read an object into a Buffer (admin downloads of private images).
 */
export async function getObjectBuffer(storageKey: string): Promise<Buffer | null> {
  try {
    const client = getS3Client();
    const response = await client.send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storageKey })
    );
    const bytes = await response.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch (error) {
    console.error('R2 get error:', error);
    return null;
  }
}

/**
 * Service image key generator
 */
export function generateServiceImageKey(serviceId: string, imageId: string): string {
  return `services/${serviceId}/${imageId}.webp`;
}

/**
 * Reference image key generator
 */
export function generateReferenceImageKey(bookingId: string, imageId: string): string {
  return `bookings/${bookingId}/references/${imageId}`;
}
