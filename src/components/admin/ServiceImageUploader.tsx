'use client';

import { useCallback, useRef, useState } from 'react';

interface ServiceImage {
  id: string;
  storageKey: string;
  publicUrl: string;
  altText: string | null;
  displayOrder: number;
}

interface ServiceImageUploaderProps {
  serviceId: string;
  serviceName: string;
  images: ServiceImage[];
  onImagesChange: (images: ServiceImage[]) => void;
}

const ALLOWED_TYPES = new Set([
  'image/webp',
  'image/jpeg',
  'image/png',
  'image/heif',
  'image/heic',
  'image/hevc',
  'image/x-heic',
  'image/x-heif',
]);

function looksLikeImageType(type: string | null): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  if (ALLOWED_TYPES.has(t)) return true;
  return t.startsWith('image/') && (t.includes('heic') || t.includes('heif'));
}

export default function ServiceImageUploader({
  serviceId,
  serviceName,
  images,
  onImagesChange,
}: ServiceImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/service-images?serviceId=${serviceId}`);
      if (!res.ok) return;
      const data = await res.json();
      onImagesChange(data.images || []);
    } catch {
      // non-fatal
    }
  }, [serviceId, onImagesChange]);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('serviceId', serviceId);
        // If the file has a name that suggests alt text, derive nothing —
        // alt text is optional and set separately. We just send the file.

        const res = await fetch('/api/admin/service-images', {
          method: 'POST',
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data.error as string) || 'Upload failed');
          return;
        }
        await fetchImages();
      } catch {
        setError('Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [serviceId, fetchImages]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!looksLikeImageType(file.type)) {
        setError('Only WEBP, JPG, PNG, HEIF and HEIC images are allowed');
        return;
      }
      if (file.size > 6 * 1024 * 1024) {
        setError('Image must be under 6 MB');
        return;
      }
      upload(file);
    },
    [upload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        looksLikeImageType(f.type) || f.name.match(/\.(webp|jpe?g|png|heic|heif)$/i)
      );
      if (files.length === 0) {
        setError('Drop an image file (WEBP, JPG, PNG, HEIF, HEIC)');
        return;
      }
      handleFile(files[0]);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so the same file can be re-uploaded if needed
      e.target.value = '';
    },
    [handleFile]
  );

  const remove = useCallback(
    async (imageId: string) => {
      if (!confirm('Remove this image from this service?')) return;
      try {
        const res = await fetch(`/api/admin/service-images?id=${imageId}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          onImagesChange(images.filter((im) => im.id !== imageId));
          if (data.warning) setError(data.warning);
        } else {
          setError((data.error as string) || 'Remove failed');
        }
      } catch {
        setError('Remove failed');
      }
    },
    [images, onImagesChange]
  );

  return (
    <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="text-lg">🖼</span> Service Images
          <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
            (WEBP, JPG, PNG, HEIF, HEIC — max 6 MB)
          </span>
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm rounded-md">
            {error}
          </div>
        )}

        {/* Upload dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-burgundy bg-burgundy/5 dark:bg-burgundy/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-burgundy/60 hover:bg-gray-50 dark:hover:bg-gray-800'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/webp,image/jpeg,image/png,image/heic,image/heif,image/hevc"
            onChange={onInputChange}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">Uploading…</div>
          ) : (
            <>
              <div className="text-3xl text-gray-400 dark:text-gray-500 mb-2">+</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Drop an image here, or click to browse
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                WEBP, JPG, PNG, HEIF, HEIC — up to 6 MB
              </p>
            </>
          )}
        </div>

        {/* Image list */}
        {images.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            No images yet. Add one above.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.publicUrl}
                  alt={img.altText || `${serviceName} image`}
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // If the image fails to load (e.g. R2 delete succeeded
                    // but the row was stale), mark it for removal.
                    const t = e.currentTarget;
                    t.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(img.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-900 text-red-600 dark:text-red-400 rounded-full p-1.5 shadow"
                    title="Remove image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                {img.altText && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1.5 py-0.5 truncate">
                    {img.altText}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
