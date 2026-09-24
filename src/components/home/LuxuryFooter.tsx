import Link from 'next/link';
import { InstagramIcon, WhatsAppIcon } from './icons';
import { BRAND, HOURS, LOCATION } from './site';
const NAV_LINKS = [
  { label: 'Services', href: '/services' },
  { label: 'Book', href: '/booking' },
  { label: 'Policies', href: '/policies' },
  { label: 'Contact', href: '/contact' },
];

/**
 * Footer (§34-35): deep-wine panel, warm-white type, columns for navigation /
 * socials / address / hours, finished with an oversized wordmark that scrolls
 * horizontally as a continuous marquee — the same .marquee-track animation
 * the hero "LASHES ✦ BROWS…" strip uses — so the full "THE BADDIES PLUG"
 * name passes through the clipped viewport band (§34).
 */
const WORDMARK_STRIP = Array.from({ length: 3 }, () => 'THE BADDIES PLUG');

export default function LuxuryFooter() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^0-9]/g, '') || '';

  return (
    <footer className="relative overflow-hidden bg-wine-deep text-warm-white">
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24 lg:px-8">
        <div className="grid grid-cols-2 gap-10 pb-14 md:grid-cols-4 md:pb-20">
          {/* Brand blurb */}
          <div className="col-span-2 md:col-span-1">
            <p className="font-editorial text-2xl font-semibold tracking-[0.04em]">
              {BRAND.name}
            </p>
            <p className="font-sans-ui mt-3 text-sm text-warm-white/60">{BRAND.tagline}</p>
          </div>

          {/* Navigation */}
          <nav aria-label="Footer">
            <h3 className="font-sans-ui text-xs tracking-[0.3em] uppercase text-rose-muted">
              Explore
            </h3>
            <ul className="mt-4 space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-editorial text-lg transition-colors hover:text-rose-muted"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Socials */}
          <div>
            <h3 className="font-sans-ui text-xs tracking-[0.3em] uppercase text-rose-muted">
              Follow
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href={LOCATION.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-3 font-editorial text-lg transition-colors hover:text-rose-muted"
                >
                  <InstagramIcon size={18} />
                  Instagram
                </a>
              </li>
              {whatsappNumber && (
                <li>
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-3 font-editorial text-lg transition-colors hover:text-rose-muted"
                  >
                    <WhatsAppIcon size={18} />
                    WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Address + hours */}
          <div>
            <h3 className="font-sans-ui text-xs tracking-[0.3em] uppercase text-rose-muted">
              Visit
            </h3>
            <p className="font-sans-ui mt-4 text-sm leading-relaxed text-warm-white/70">
              {LOCATION.address}
            </p>
            <p className="font-sans-ui mt-3 text-sm leading-relaxed text-warm-white/70">
              {HOURS.weekday}
              <br />
              {HOURS.closed}
            </p>
          </div>
        </div>
      </div>

      {/* Oversized clipped wordmark (§34) — continuous horizontal scroll,
          mirroring the BrandMarquee treatment. Two identical strips make the
          -50% keyframe loop seamless; duplicated strip is aria-hidden. */}
      <div className="footer-marquee select-none overflow-hidden" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((stripIdx) => (
            <div key={stripIdx} className="flex shrink-0 items-center">
              {WORDMARK_STRIP.map((word, i) => (
                <span key={i} className="flex items-center">
                  <span
                    className="font-editorial whitespace-nowrap px-6 font-semibold leading-[0.8] tracking-tight text-warm-white/[0.08] md:px-10"
                    style={{ fontSize: 'clamp(5rem, 18vw, 20rem)', marginBottom: '-0.18em' }}
                  >
                    {word}
                  </span>
                  <span
                    className="text-rose-muted/20"
                    style={{ fontSize: 'clamp(2rem, 6vw, 6rem)' }}
                  >
                    ✦
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legal line */}
      <div className="border-t border-warm-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 font-sans-ui text-xs text-warm-white/50 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} The Baddies Plug. All rights reserved.</p>
          <p>Lagos, Nigeria</p>
        </div>
      </div>
    </footer>
  );
}
