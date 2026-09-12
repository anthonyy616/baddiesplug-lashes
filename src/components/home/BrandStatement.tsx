'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import SmartImage from './SmartImage';

/** Editorial image, resolved server-side (admin upload or site.ts fallback). */
export interface EditorialMedia {
  src: string;
  alt: string;
}

/**
 * Editorial brand statement (§23): quiet section with a portrait image on one
 * side and a short statement. Image scales 1.0 → 1.04 across the scroll range.
 * Falls back to a static image under reduced motion.
 */
export default function BrandStatement({ media }: { media: EditorialMedia }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.04]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-warm-white text-ink-black dark:bg-wine-deep dark:text-warm-white"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-32 lg:gap-16 lg:px-8">
        {/* Image — portrait, edge-to-edge on its half, no rounded frame (§10) */}
        <motion.div style={{ scale: reduced ? 1 : scale }} className="relative">
          <SmartImage
            src={media.src}
            alt={media.alt}
            aspectRatio="3 / 4"
            sizes="(max-width: 768px) 100vw, 40vw"
          />
        </motion.div>

        {/* Statement */}
        <div className="md:pl-8">
          <p className="font-sans-ui mb-6 text-xs tracking-[0.35em] uppercase text-burgundy dark:text-rose-muted">
            The Standard
          </p>
          <p
            className="font-editorial font-medium leading-[1.08] tracking-tight"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 4.5rem)' }}
          >
            For the girls who like their eyes to speak first.
          </p>
          <p className="font-sans-ui mt-8 max-w-md text-sm leading-relaxed text-ink-secondary dark:text-warm-white/60">
            Every set is mapped to your eye shape, your lifestyle, and your
            level of drama — from barely-there classics to full glam volume.
            No rush, no assembly line. Just lashes.
          </p>
        </div>
      </div>
    </section>
  );
}
