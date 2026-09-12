/**
 * Homepage constants — the ONE place to edit business details and image keys.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TO GO LIVE WITH REAL DATA:
 *  1. Replace the PLACEHOLDER values below (address, map query, Instagram).
 *  2. Upload photos to Cloudflare R2 bucket `baddiesplug-lashes` using the
 *     exact object keys listed in HOME_IMAGES (see keys in gallery config).
 *  3. Ensure R2_PUBLIC_URL=https://media.thebaddiesplug.online is set in env
 *     (this must be the custom media hostname from the redesign plan, §28).
 * No code changes are needed after that — images appear automatically.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Production canonical domain (§50). */
export const SITE_URL = 'https://thebaddiesplug.online';

/** Static brand copy. */
export const BRAND = {
  name: 'THE BADDIES PLUG',
  tagline: 'Lashes made for the baddie in you.',
} as const;

/** Editorial serif class applied to every homepage section. */
export const EDITORIAL_FONT = 'font-editorial';

/**
 * Image manifest for the redesign. Each entry points at a fixed R2 key.
 * Missing objects gracefully render as branded placeholders (see SmartImage),
 * so uploading a file to the exact key below makes it appear with zero code
 * changes. Serve WebP/AVIF (§28-29).
 */
export const HOME_IMAGES = {
  hero: {
    src: 'https://media.thebaddiesplug.online/home/hero.webp',
    alt: 'Close-up of a luxury lash set — soft volume lashes on a model',
  },
  editorial: {
    src: 'https://media.thebaddiesplug.online/home/editorial.webp',
    alt: 'Editorial portrait of a client with lashes by The Baddies Plug',
  },
  gallery: [
    'https://media.thebaddiesplug.online/gallery/01.webp',
    'https://media.thebaddiesplug.online/gallery/02.webp',
    'https://media.thebaddiesplug.online/gallery/03.webp',
    'https://media.thebaddiesplug.online/gallery/04.webp',
    'https://media.thebaddiesplug.online/gallery/05.webp',
    'https://media.thebaddiesplug.online/gallery/06.webp',
  ],
} as const;

/**
 * Business location data (§31-33).
 * ⚠ PLACEHOLDERS — replace with the real address supplied by the owner.
 */
export const LOCATION = {
  // Street address shown in the location section and footer.
  address: '5 Adenike Wole Ajibode St, Lekki Phase I, Lagos 106104, Lagos',
  // Used for both the maps embed and the "Get Directions" link. Using a
  // free-text query means no place ID needs to be looked up.
  mapQuery: '5 Adenike Wole Ajibode St, Lekki Phase I, Lagos 106104, Lagos',
  instagramUrl: 'https://instagram.com/the_baddiesplug', //actual handle, might change later on
} as const;

/** Opening hours — mirrors the hours already published on /contact. */
export const HOURS = {
  weekday: 'Tuesday – Friday · 9:00 AM – 6:00 PM WAT',
  closed: 'Monday, Saturday & Sunday — Closed',
} as const;

/** Build the Google Maps embed URL (keyless, lazy-loaded iframe, §32). */
export function mapEmbedUrl(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

/** Build the external Google Maps directions URL. */
export function mapDirectionsUrl(query: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}
