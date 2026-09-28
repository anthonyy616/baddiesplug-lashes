'use client';

import { useState } from 'react';
import type { GalleryViewImage } from './home-media';

export default function GalleryViewGrid({
  serviceName,
  images,
}: {
  serviceName: string;
  images: GalleryViewImage[];
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const close = () => setSelected(null);
  const previous = () => setSelected((current) => current === null ? null : (current - 1 + images.length) % images.length);
  const next = () => setSelected((current) => current === null ? null : (current + 1) % images.length);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setSelected(index)}
            className="group relative aspect-4/5 overflow-hidden bg-gray-100 text-left"
            aria-label={`View ${image.caption ?? serviceName} image ${index + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-3 pb-3 pt-8 text-xs uppercase tracking-[0.18em] text-white opacity-0 transition-opacity group-hover:opacity-100">
              {image.caption ?? serviceName}
            </span>
          </button>
        ))}
      </div>

      {selected !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${serviceName} gallery viewer`}
          onClick={close}
        >
          <button type="button" onClick={close} className="absolute right-5 top-4 text-3xl text-white" aria-label="Close viewer">×</button>
          {images.length > 1 && (
            <>
              <button type="button" onClick={(event) => { event.stopPropagation(); previous(); }} className="absolute left-4 text-4xl text-white" aria-label="Previous image">‹</button>
              <button type="button" onClick={(event) => { event.stopPropagation(); next(); }} className="absolute right-4 text-4xl text-white" aria-label="Next image">›</button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[selected].src}
            alt={images[selected].alt}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
