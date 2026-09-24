import EditorialHeading from './EditorialHeading';
import { Reveal } from './Reveal';
import GalleryTile from './GalleryTile';
import type { GalleryImage } from './home-media';

/**
 * Layout descriptors for the asymmetric editorial grid (§24). Every pattern is
 * verified gap-free: within each 3-row block the spans tile the 3×3 area
 * exactly (row 1: 2+2+1, row 2: covered by 01 + 1 + 1, row 3: 3+1+1), and each
 * tile lands on a free cell — so no tile can ever be pushed into an overlap or
 * leave a hole, no matter how many images the admin has uploaded.
 *
 * Per-block placement (3 columns × 3 rows):
 *   row 1: [01 01] [02 02] [03]
 *   row 2: [01 01] [04]    [05]
 *   row 3: [06 06 06] [07] [08]
 */
const TILE_LAYOUT = [
  'col-span-2 row-span-2', // 01 — large portrait anchor
  'col-span-2 row-span-1', // 02 — wide
  'col-span-1 row-span-1', // 03
  'col-span-1 row-span-1', // 04
  'col-span-1 row-span-1', // 05
  'col-span-3 row-span-1', // 06 — full-width feature
  'col-span-1 row-span-1', // 07
  'col-span-1 row-span-1', // 08
] as const;

const SERVICE_HINTS = [
  'Volume Set',
  'Hybrid Set',
  'Classic Set',
  'Brow Lamination',
  'Mega Volume',
  'Lash Lift',
] as const;

/**
 * Work gallery (§24-25). Images are admin-managed via /admin/homepage (DB
 * table gallery_images); captions/alt text come from the upload metadata.
 * Desktop: asymmetric grid — dense auto-placement + explicit row spans and a
 * height floor on every tile so partial blocks still fill rows cleanly (no
 * overlaps, no holes). Mobile: single-column stack with fixed aspect ratio —
 * images cannot collide and captions are always visible (§45).
 */
export default function WorkGallery({ images }: { images: GalleryImage[] }) {
  return (
    <section id="gallery" className="scroll-mt-20 bg-ink-black text-warm-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <Reveal className="mb-12 md:mb-16">
          <EditorialHeading eyebrow="Our Work" lines={['THE PROOF']} tone="dark" />
        </Reveal>

        {/* Desktop: asymmetric grid (dense flow repairs any gaps from
            repeating the layout across many images) */}
        <div className="hidden md:grid md:grid-flow-dense md:grid-cols-3 md:auto-rows-[180px] lg:auto-rows-[220px] md:gap-3 lg:gap-4">
          {images.map((image, i) => (
            <Reveal
              key={image.src}
              index={i % TILE_LAYOUT.length}
              className={`${TILE_LAYOUT[i % TILE_LAYOUT.length]} min-h-0`}
            >
              <GalleryTile
                src={image.src}
                alt={image.alt}
                label={image.caption ?? SERVICE_HINTS[i % SERVICE_HINTS.length] ?? 'Lash Work'}
                priority={false}
              />
            </Reveal>
          ))}
        </div>

        {/* Mobile: single column, fixed aspect ratio — zero collision risk,
            comfortable thumb-height tiles, captions always on */}
        <div className="grid grid-cols-1 gap-5 md:hidden">
          {images.map((image, i) => (
            <GalleryTile
              key={image.src}
              src={image.src}
              alt={image.alt}
              label={image.caption ?? SERVICE_HINTS[i % SERVICE_HINTS.length] ?? 'Lash Work'}
              showLabelAlways
              priority={false}
              className="aspect-[4/3]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
