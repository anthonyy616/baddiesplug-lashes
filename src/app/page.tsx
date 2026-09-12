import type { Metadata } from 'next';
import LuxuryNavbar from '@/components/home/LuxuryNavbar';
import Hero from '@/components/home/Hero';
import BrandMarquee from '@/components/home/BrandMarquee';
import FeaturedServices from '@/components/home/FeaturedServices';
import BrandStatement from '@/components/home/BrandStatement';
import WorkGallery from '@/components/home/WorkGallery';
import BookingCTA from '@/components/home/BookingCTA';
import LocationSection from '@/components/home/LocationSection';
import LuxuryFooter from '@/components/home/LuxuryFooter';
import { MotionProvider } from '@/components/home/MotionProvider';
import { SITE_URL } from '@/components/home/site';
import {
  getHeroImage,
  getEditorialImage,
  getGalleryImages,
} from '@/components/home/home-media';

// Services are queried from the DB at request time so admin changes show
// immediately (same as /services).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The Baddies Plug | Luxury Lash & Brow Studio — Lagos',
  description:
    'Book luxury lash extensions and brow services at The Baddies Plug, Lagos. Classic, hybrid and volume sets by specialists. Your eyes. Your look. Your era.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'The Baddies Plug | Luxury Lash & Brow Studio',
    description:
      'Lashes made for the baddie in you. Book your appointment — classic, hybrid and volume sets in Lagos.',
    url: SITE_URL,
    type: 'website',
  },
};

/**
 * v2 luxury homepage. Composition only — every section is its own component
 * (§47); only interaction-dependent pieces are client components (§48).
 * The SilkBackground hero keeps its signature dark treatment in both color
 * schemes; sections below the marquee are theme-aware (warm-white light /
 * deep-wine dark) via dark: variants.
 *
 * Imagery is admin-managed (DB) with static-key fallbacks: hero/editorial
 * come from homepage_media (uploaded at /admin/homepage), gallery from
 * gallery_images, and featured services respect the admin's isFeatured flag.
 */
export default async function HomePage() {
  const [hero, editorial, gallery] = await Promise.all([
    getHeroImage(),
    getEditorialImage(),
    getGalleryImages(),
  ]);

  return (
    <MotionProvider>
      <div className="home-page bg-ink-black">
        <LuxuryNavbar />
        <main>
          <Hero media={hero} />
          <BrandMarquee />
          <FeaturedServices />
          <BrandStatement media={editorial} />
          <WorkGallery images={gallery} />
          <BookingCTA />
          <LocationSection />
        </main>
        <LuxuryFooter />
      </div>
    </MotionProvider>
  );
}
