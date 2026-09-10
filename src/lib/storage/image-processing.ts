import sharp from 'sharp';

/**
 * Server-side image processing pipeline (per storage-spec.md / production.md Tier 3):
 * decode -> verify decodability -> strip metadata -> resize -> compress -> convert to .webp.
 *
 * Every uploaded image (service images and customer reference photos) is re-encoded,
 * so the stored bytes are always true WebP regardless of what the client sent
 * (including HEIC/HEIF from iPhones). This fixes the previous behavior where a
 * raw 6 MB HEIC was stored under a .webp key with its original bytes intact.
 */

export interface ProcessedImage {
  buffer: Buffer;
  /** Always 'image/webp' — the pipeline re-encodes everything to WebP. */
  contentType: 'image/webp';
  width: number;
  height: number;
  /** Original byte size, for logging/audit. */
  originalSize: number;
  /** Processed byte size. */
  size: number;
}

const EXPORTED_MIME = 'image/webp' as const;

/**
 * Decode + normalize an uploaded image into a compressed WebP.
 * Throws if the bytes are not a decodable image — callers should treat that
 * as a 400 ("file is not a valid image"), never store the raw upload.
 */
export async function processImageToWebP(
  input: Buffer,
  opts: {
    /** Max width/height in px; larger images are downscaled proportionally. */
    maxDimension?: number;
    /** WebP quality (1-100). */
    quality?: number;
  } = {}
): Promise<ProcessedImage> {
  const { maxDimension = 1600, quality = 80 } = opts;

  const transformer = sharp(input, { failOn: 'error' })
    // Verify the bytes actually decode — this is the "decodability check"
    // Tier 10 asks for. Rotation is applied from EXIF before stripping it.
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    // Strip all metadata (EXIF, GPS, color profiles) — privacy + smaller files.
    .withMetadata({ exif: {}, icc: undefined })
    .webp({ quality })
    .on('error', (err) => {
      throw new Error(`Image is not a valid or supported image format: ${err.message}`);
    });

  const { data, info } = await transformer.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    contentType: EXPORTED_MIME,
    width: info.width,
    height: info.height,
    originalSize: input.length,
    size: data.length,
  };
}
