'use client';

import { useState } from 'react';
import Image from 'next/image';

interface SmartImageProps {
  src: string;
  alt: string;
  /** Aspect ratio for the frame, e.g. 4/5 → "4 / 5". */
  aspectRatio?: string;
  /** next/image sizes hint. */
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Filled placeholders read "AWAITING R2 KEY" quietly; gallery ones do not. */
  showPlaceholderLabel?: boolean;
}

/**
 * Renders an image from the fixed R2 key when the object exists, or an elegant
 * burgundy placeholder when it does not (or R2 is not configured yet). This is
 * what lets the redesign ship today and go photographic later with zero code
 * changes — see keys in src/components/home/site.ts.
 */
export default function SmartImage({
  src,
  alt,
  aspectRatio = '4 / 5',
  sizes = '(max-width: 768px) 100vw, 50vw',
  priority = false,
  className = '',
  showPlaceholderLabel = false,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        aria-hidden="true"
        className={`placeholder-frame relative overflow-hidden ${className}`}
        style={{ aspectRatio }}
      >
        <div className="absolute inset-0 placeholder-sheen" />
        <svg
          viewBox="0 0 120 60"
          className="absolute inset-0 m-auto w-1/2 h-1/2 text-burgundy/40 dark:text-burgundy-lifted/40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M8 48 C 20 20, 32 16, 36 44" />
          <path d="M32 46 C 42 14, 54 12, 58 42" />
          <path d="M54 44 C 62 10, 74 10, 78 40" />
          <path d="M76 44 C 84 16, 94 18, 96 42" />
        </svg>
        {showPlaceholderLabel && (
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em] uppercase text-current opacity-40 font-sans-ui">
            {src.split('/').slice(-2).join('/')}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio }}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        onError={() => setFailed(true)}
        className="object-cover"
      />
    </div>
  );
}
