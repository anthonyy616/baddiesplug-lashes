import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { db } from '@/lib/db';
import { services } from '@/lib/db/schema';
import { and, asc, desc, eq } from 'drizzle-orm';
import EditorialHeading from './EditorialHeading';
import { Reveal } from './Reveal';
import ServiceRowFX from './ServiceRowFX';

const PREVIEW_COUNT = 4;

/**
 * Featured services (§20-22). Real data from the services table — never
 * hardcoded (§2, §52). Admin marks services as featured in the admin panel;
 * featured services are shown first and the first 4 render here (falling back
 * to display order when nothing is featured). Desktop: large editorial rows
 * with number, name, description, price and arrow; a preview image follows the
 * cursor on hover. Mobile: stacked editorial cards with portrait image, title,
 * description, price and duration — nothing hover-only (§45).
 */
export default async function FeaturedServices() {
  const rows = await db.query.services.findMany({
    where: and(eq(services.isActive, true)),
    orderBy: [desc(services.isFeatured), asc(services.category), asc(services.displayOrder)],
    limit: PREVIEW_COUNT,
    with: {
      images: {
        limit: 1,
        orderBy: (img, { asc }) => [asc(img.displayOrder)],
      },
    },
  });

  if (rows.length === 0) {
    return null; // Section quietly hides until services exist (e.g. fresh DB).
  }

  const formatPrice = (kobo: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(kobo / 100);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  };

  return (
    <section className="relative bg-warm-white text-ink-black dark:bg-wine-deep dark:text-warm-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <Reveal className="mb-12 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
          <EditorialHeading
            eyebrow="The Menu"
            lines={['SIGNATURE', 'SERVICES']}
            tone="light"
            /* 2x the shared header default (text-xs md:text-sm): 24px mobile,
               up to 30px desktop. Inline style beats variant sort order. */
            eyebrowStyle={{ fontSize: 'clamp(1.5rem, 2.2vw, 1.875rem)' }}
            /* Match the "View all services" link in BOTH color schemes.
               Unlayered class — beats the tone color in sort order. */
            headingClassName="heading-accent"
          />          <Link
            href="/services"
            className="group/viewall inline-flex shrink-0 items-center gap-2 font-sans-ui text-xs tracking-[0.25em] uppercase text-burgundy transition-colors hover:text-wine dark:text-rose-muted dark:hover:text-warm-white md:mb-3"
          >
            View all services
            <ArrowUpRight
              size={16}
              strokeWidth={1.75}
              className="transition-transform duration-300 group-hover/viewall:translate-x-0.5 group-hover/viewall:-translate-y-0.5"
              aria-hidden="true"
            />
          </Link>
        </Reveal>

        {/* ── Desktop: editorial rows with cursor-following preview ── */}
        <div className="hidden md:block">
          <ServiceRowFX />
          <ul className="divide-y divide-ink-black/10 dark:divide-warm-white/10">
            {rows.map((service, i) => (
              <li key={service.id}>
                <Reveal index={i}>
                  <ServiceRow
                    index={i + 1}
                    slug={service.slug}
                    name={service.name}
                    description={service.description}
                    price={formatPrice(service.price)}
                    imageUrl={service.images[0]?.publicUrl}
                    imageAlt={service.images[0]?.altText || service.name}
                  />
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Mobile: stacked editorial cards, no hover dependency ── */}
        <div className="md:hidden">
          <ul className="space-y-10">
            {rows.map((service, i) => (
              <li key={service.id}>
                <Reveal index={i}>
                  <ServiceCard
                    index={i + 1}
                    slug={service.slug}
                    name={service.name}
                    description={service.description}
                    price={formatPrice(service.price)}
                    duration={formatDuration(service.durationMinutes)}
                    imageUrl={service.images[0]?.publicUrl}
                    imageAlt={service.images[0]?.altText || service.name}
                  />
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Desktop row ────────────────────────── */

function ServiceRow({
  index,
  slug,
  name,
  description,
  price,
  imageUrl,
  imageAlt,
}: {
  index: number;
  slug: string;
  name: string;
  description: string;
  price: string;
  imageUrl?: string;
  imageAlt: string;
}) {
  return (
    <Link
      href={`/services/${slug}`}
      className="service-row group relative flex items-center gap-6 py-7 transition-colors duration-300 lg:gap-10 lg:py-9"
    >
      <span className="font-sans-ui w-8 shrink-0 text-sm tracking-widest text-burgundy/70 dark:text-rose-muted/80">
        {String(index).padStart(2, '0')}
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="font-editorial text-3xl font-semibold leading-tight transition-transform duration-500 group-hover:translate-x-2 lg:text-4xl">
          {name}
        </h3>
        <p className="font-sans-ui mt-1 line-clamp-1 text-sm text-ink-secondary dark:text-warm-white/60">
          {description}
        </p>
      </div>

      <div className="text-right">
        <p className="font-sans-ui text-sm text-ink-secondary dark:text-warm-white/60">From</p>
        <p className="font-sans-ui text-lg font-semibold text-burgundy dark:text-rose-muted">
          {price}
        </p>
      </div>

      <span
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-black/15 transition-all duration-300 group-hover:border-burgundy group-hover:bg-burgundy group-hover:text-warm-white dark:border-warm-white/20"
        aria-hidden="true"
      >
        <ArrowUpRight size={18} strokeWidth={1.75} />
      </span>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="service-row-img pointer-events-none absolute right-24 top-1/2 z-10 hidden h-56 w-44 -translate-y-1/2 rotate-2 object-cover shadow-2xl lg:block"
        />
      )}
      {!imageUrl && (
        <span
          className="service-row-img pointer-events-none absolute right-24 top-1/2 z-10 hidden h-56 w-44 -translate-y-1/2 rotate-2 bg-gradient-to-br from-burgundy to-wine shadow-2xl lg:block"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

/* ────────────────────────── Mobile card ────────────────────────── */

function ServiceCard({
  index,
  slug,
  name,
  description,
  price,
  duration,
  imageUrl,
  imageAlt,
}: {
  index: number;
  slug: string;
  name: string;
  description: string;
  price: string;
  duration: string;
  imageUrl?: string;
  imageAlt: string;
}) {
  return (
    <Link href={`/services/${slug}`} className="group block">        <div className="md:hidden relative overflow-hidden" style={{ aspectRatio: '2 / 3' }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={imageAlt}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-burgundy to-wine"
            aria-hidden="true"
          >
            <span className="font-editorial text-5xl text-warm-white/40">✦</span>
          </div>
        )}
        <span className="font-sans-ui absolute left-4 top-4 text-xs tracking-widest text-warm-white/90">
          {String(index).padStart(2, '0')}
        </span>
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-editorial text-2xl font-semibold">{name}</h3>
          <p className="font-sans-ui mt-1 line-clamp-2 text-sm text-ink-secondary dark:text-warm-white/60">
            {description}
          </p>
        </div>
        <span
          className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-black/15 dark:border-warm-white/20"
          aria-hidden="true"
        >
          <ArrowUpRight size={18} strokeWidth={1.75} />
        </span>
      </div>

      <div className="font-sans-ui mt-3 flex items-center gap-4 text-sm">
        <span className="font-semibold text-burgundy dark:text-rose-muted">{price}</span>
        <span className="text-ink-secondary dark:text-warm-white/50">{duration}</span>
      </div>
    </Link>
  );
}
