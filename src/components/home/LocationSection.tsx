import { Clock, MapPin } from 'lucide-react';
import EditorialHeading from './EditorialHeading';
import { Reveal } from './Reveal';
import CtaLink from './CtaLink';
import { InstagramIcon, WhatsAppIcon } from './icons';
import { HOURS, LOCATION, mapDirectionsUrl, mapEmbedUrl } from './site';

/**
 * Location (§31-33): one designed block — studio details left, lazy keyless
 * Google Maps embed right. Address/Instagram are PLACEHOLDERS until the owner
 * fills src/components/home/site.ts; hours mirror the live /contact page and
 * WhatsApp reuses NEXT_PUBLIC_WHATSAPP_NUMBER like the contact page.
 */
export default function LocationSection() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^0-9]/g, '') || '';

  return (
    <section className="bg-warm-white text-ink-black dark:bg-wine-deep dark:text-warm-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <Reveal className="mb-12 md:mb-16">
          <EditorialHeading eyebrow="The Studio" lines={['VISIT US']} tone="light" />
        </Reveal>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-0">
          {/* Details */}
          <Reveal className="flex flex-col justify-center lg:pr-14">
            <div className="space-y-8">
              <div className="flex gap-4">
                <MapPin size={20} strokeWidth={1.5} className="mt-1 shrink-0 text-burgundy dark:text-rose-muted" aria-hidden="true" />
                <div>
                  <h3 className="font-sans-ui text-xs tracking-[0.3em] uppercase text-ink-secondary dark:text-warm-white/60">
                    Address
                  </h3>
                  <p className="font-editorial mt-2 text-xl leading-snug md:text-2xl">
                    {LOCATION.address}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Clock size={20} strokeWidth={1.5} className="mt-1 shrink-0 text-burgundy dark:text-rose-muted" aria-hidden="true" />
                <div>
                  <h3 className="font-sans-ui text-xs tracking-[0.3em] uppercase text-ink-secondary dark:text-warm-white/60">
                    Hours
                  </h3>
                  <p className="font-editorial mt-2 text-xl leading-snug md:text-2xl">{HOURS.weekday}</p>
                  <p className="font-sans-ui mt-1 text-sm text-ink-secondary dark:text-warm-white/60">
                    {HOURS.closed}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <a
                  href={LOCATION.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex min-h-[44px] items-center gap-3 py-2 font-sans-ui text-sm tracking-[0.15em] uppercase text-ink-black transition-colors hover:text-burgundy dark:text-warm-white dark:hover:text-rose-muted"
                >
                  <InstagramIcon size={20} />
                  Instagram
                  <span className="text-burgundy transition-transform duration-300 group-hover/link:translate-x-1 dark:text-rose-muted" aria-hidden="true">→</span>
                </a>

                {whatsappNumber && (
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/link inline-flex min-h-[44px] items-center gap-3 py-2 font-sans-ui text-sm tracking-[0.15em] uppercase text-ink-black transition-colors hover:text-burgundy dark:text-warm-white dark:hover:text-rose-muted"
                  >
                    <WhatsAppIcon size={20} />
                    WhatsApp
                    <span className="text-burgundy transition-transform duration-300 group-hover/link:translate-x-1 dark:text-rose-muted" aria-hidden="true">→</span>
                  </a>
                )}
              </div>

              <div>
                <CtaLink href={mapDirectionsUrl(LOCATION.mapQuery)} external variant="primary">
                  Get Directions
                </CtaLink>
              </div>
            </div>
          </Reveal>

          {/* Map — lazy, keyless, borderless (§32) */}
          <Reveal delay={0.1} className="relative">
            <div className="relative h-[320px] w-full overflow-hidden sm:h-[420px] lg:h-full lg:min-h-[540px]">
              <iframe
                title={`Map — The Baddies Plug location`}
                src={mapEmbedUrl(LOCATION.mapQuery)}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0 grayscale-[0.35] dark:opacity-90"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
