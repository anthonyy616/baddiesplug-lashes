'use client';

import { motion, useReducedMotion } from 'motion/react';
import SilkBackground from './SilkBackground';
import LashLines from './LashLines';
import SmartImage from './SmartImage';
import CtaLink from './CtaLink';
import { MaskedLines } from './Reveal';
import { BRAND } from './site';

/** Hero image, resolved server-side (admin upload or site.ts fallback). */
export interface HeroMedia {
  src: string;
  alt: string;
}

/**
 * Hero (§9-12, §40). ~90svh editorial split: stacked three-line headline
 * overlapping a tall portrait photo, tagline + booking CTA beneath. Silk
 * background and lash curves sit behind. The two-column composition (copy
 * left, portrait right) is kept at every breakpoint — on mobile it simply
 * tightens (smaller type floor, narrower image column) instead of stacking,
 * so the studio tagline sits directly above the headline with the photo
 * beside it (§40). Hero image is priority/LCP (§29); fades in once loaded (§49).
 */
export default function Hero({ media }: { media: HeroMedia }) {
  const reduced = useReducedMotion();

  return (
    <section className="relative flex min-h-[90svh] flex-col overflow-hidden bg-ink-black text-warm-white">
      <SilkBackground />
      <LashLines className="lash-svg left-[6%] top-[16%] h-[46%] w-[30%] text-rose-muted/25" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 grid-cols-[1.15fr_0.85fr] items-center gap-3 px-4 pb-16 pt-28 sm:px-6 md:gap-6 md:pt-24 lg:px-8">
        {/* Copy column */}
        <div className="order-1">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="font-editorial mb-4 text-rose-muted md:mb-8"
            style={{
              fontSize: 'clamp(0.8rem, 2.6vw, 2.5rem)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Luxury Lash &amp; Brow Studio — Lagos
          </motion.p>

          <h1
            className="font-editorial font-semibold leading-[0.92] tracking-tight"
            style={{ fontSize: 'clamp(2.4rem, 10vw, 10rem)' }}
          >
            <MaskedLines
              lines={['YOUR EYES.', 'YOUR LOOK.', 'YOUR ERA.']}
              delay={0.25}
              textColor="text-warm-white"
            />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9 }}
            className="font-sans-ui mt-4 max-w-md text-xs sm:text-sm md:mt-6 md:text-base text-warm-white/70"
          >
            {BRAND.tagline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.05 }}
            className="mt-6 flex flex-wrap items-center gap-3 md:mt-8 md:gap-4"
          >
            <CtaLink href="/booking">Book Appointment</CtaLink>
            <CtaLink href="/services" variant="outline">
              View Services
            </CtaLink>
          </motion.div>
        </div>

        {/* Image column — tall portrait, slight rotation, minimal framing (§10) */}
        <motion.div
          initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative order-2 justify-self-end"
        >
          <div className="relative -rotate-1 w-[9.5rem] sm:w-[13rem] md:w-[26rem] lg:w-[30rem]">
            <SmartImage
              src={media.src}
              alt={media.alt}
              aspectRatio="4 / 5"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 45vw, 560px"
              priority
              showPlaceholderLabel
              className="shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]"
            />
          </div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
        className="relative z-10 hidden justify-center pb-8 md:flex"
        aria-hidden="true"
      >
        <div className="h-12 w-px bg-gradient-to-b from-transparent via-warm-white/40 to-transparent" />
      </motion.div>
    </section>
  );
}
