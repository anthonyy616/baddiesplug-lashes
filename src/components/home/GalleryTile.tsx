'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface GalleryTileProps {
  src: string;
  alt: string;
  label: string;
  showLabelAlways?: boolean;
  priority: boolean;
  href?: string;
  /** Extra classes for the outer figure — used for mobile sizing. */
  className?: string;
}

/**
 * One gallery image (§25): slow scale on hover, darker overlay, service label
 * + VIEW affordance (desktop). On mobile the label is always shown so no
 * information is hover-only (§45). Missing R2 objects degrade to a branded
 * placeholder so the layout never collapses.
 */
export default function GalleryTile({
  src,
  alt,
  label,
  showLabelAlways = false,
  priority,
  href,
  className = '',
}: GalleryTileProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    const fallback = (
      <div
        className="group relative h-full min-h-55 w-full overflow-hidden bg-linear-to-br from-wine via-wine-deep to-ink-black"
        aria-hidden="true"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-editorial text-4xl text-warm-white/25">✦</span>
        </div>
        {showLabelAlways && (
          <span className="font-sans-ui absolute bottom-3 left-3 text-xs tracking-[0.2em] uppercase text-warm-white/70">
            {label}
          </span>
        )}
      </div>
    );
    return href ? <Link href={href} className="block h-full">{fallback}</Link> : fallback;
  }

  const tile = (
    <figure className={`group relative h-full w-full overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 50vw, 33vw"
        loading="lazy"
        onError={() => setFailed(true)}
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05] motion-reduce:transition-none"
      />
      <div
        className="absolute inset-0 bg-linear-to-t from-ink-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden="true"
      />
      <figcaption
        className={`absolute bottom-4 left-4 right-4 flex items-center justify-between transition-opacity duration-500 ${
          showLabelAlways ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <span className="font-sans-ui text-xs tracking-[0.25em] uppercase text-warm-white">
          {label}
        </span>
        <span className="inline-flex items-center gap-1 font-sans-ui text-xs tracking-[0.2em] uppercase text-warm-white/90">
          View
          <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </figcaption>
    </figure>
  );

  return href ? <Link href={href} className="block h-full">{tile}</Link> : tile;
}
