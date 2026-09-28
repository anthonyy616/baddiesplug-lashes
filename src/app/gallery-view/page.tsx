import Link from 'next/link';
import GalleryViewGrid from '@/components/home/GalleryViewGrid';
import { getGalleryViewData } from '@/components/home/home-media';

export const dynamic = 'force-dynamic';

export default async function GalleryViewPage() {
  const categories = await getGalleryViewData();
  const hasImages = categories.some((category) => category.services.some((service) => service.images.length > 0));

  return (
    <main className="min-h-screen bg-ink-black text-warm-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Link href="/" className="font-sans-ui text-xs uppercase tracking-[0.2em] text-warm-white/60 hover:text-warm-white">
          ← Back home
        </Link>
        <header className="mt-10 max-w-3xl">
          <p className="font-sans-ui text-xs uppercase tracking-[0.25em] text-warm-white/60">The proof</p>
          <h1 className="mt-3 font-editorial text-5xl uppercase leading-none sm:text-7xl">Our work</h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-warm-white/70">
            Browse our latest lash and brow work, organized by service.
          </p>
        </header>

        {!hasImages && (
          <p className="mt-16 border-t border-warm-white/15 pt-8 text-sm text-warm-white/60">Gallery images are coming soon.</p>
        )}

        <div className="mt-16 space-y-20">
          {categories.map((category) => (
            <section key={category.name} aria-labelledby={`gallery-${category.name}`}>
              <h2 id={`gallery-${category.name}`} className="border-b border-warm-white/15 pb-4 font-editorial text-3xl uppercase sm:text-4xl">
                {category.name}
              </h2>
              <div className="mt-10 space-y-14">
                {category.services.map((service) => (
                  <div key={service.id}>
                    <div className="mb-5 flex items-end justify-between gap-4">
                      <h3 className="font-sans-ui text-sm uppercase tracking-[0.2em]">{service.name}</h3>
                      {service.slug !== 'unassigned' && (
                        <Link href={`/services/${service.slug}`} className="text-xs uppercase tracking-[0.16em] text-warm-white/60 hover:text-warm-white">
                          Service details →
                        </Link>
                      )}
                    </div>
                    <GalleryViewGrid serviceName={service.name} images={service.images} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
