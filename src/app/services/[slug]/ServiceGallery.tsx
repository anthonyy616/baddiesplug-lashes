'use client';

import { useState, useRef, useEffect } from 'react';

interface GalleryImage {
  id: string;
  publicUrl: string;
  altText?: string | null;
}

interface ServiceGalleryProps {
  images: GalleryImage[];
  serviceName: string;
}

export default function ServiceGallery({ images, serviceName }: ServiceGalleryProps) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const next = () => setCurrent((c) => (c + 1) % Math.max(images.length, 1));
  const prev = () =>
    setCurrent((c) => (c - 1 + Math.max(images.length, 1)) % Math.max(images.length, 1));

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, images.length]);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-burgundy/10 rounded-xl flex items-center justify-center">
        <span className="text-burgundy text-6xl font-bold">✦</span>
      </div>
    );
  }

  const openLightbox = () => setLightboxOpen(true);

  return (
    <div>
      {/* Main image */}
      <div
        className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 cursor-zoom-in"
        onClick={openLightbox}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(delta) > 50) {
            if (delta < 0) next();
            else prev();
          }
          touchStartX.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[current].publicUrl}
          alt={images[current].altText || serviceName}
          className="w-full h-full object-cover"
        />

        {images.length > 1 && (
          <>
            <button
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
            >
              ‹
            </button>
            <button
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${i === current ? 'bg-burgundy' : 'bg-white/60'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2 mt-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setCurrent(i)}
              className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                i === current ? 'border-burgundy' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.publicUrl}
                alt={img.altText || `${serviceName} thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${serviceName} image viewer`}
        >
          <button
            aria-label="Close viewer"
            className="absolute top-4 right-4 text-white text-3xl w-10 h-10"
            onClick={() => setLightboxOpen(false)}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[current].publicUrl}
            alt={images[current].altText || serviceName}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {images.length > 1 && (
            <>
              <button
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl"
              >
                ‹
              </button>
              <button
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
