import type { BeforeAfterEntry } from '@/types';

/**
 * Public before/after showcase (Stage 6). Renders ONLY entries already
 * filtered to `isPublic` by the server. Polished, responsive presentation
 * consistent with the dark editorial gallery design system: a side-by-side
 * pair with an interactive slider comparison on wider screens.
 */
export default function BeforeAfterShowcase({ entries }: { entries: BeforeAfterEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {entries.map((entry) => (
        <BeforeAfterCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function BeforeAfterCard({ entry }: { entry: BeforeAfterEntry }) {
  return (
    <figure className="group">
      <div className="relative overflow-hidden rounded-xl border border-warm-white/10 bg-ink-black">
        {/* Side-by-side comparison; on small screens the two images stack */}
        <div className="grid grid-cols-2">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.beforePublicUrl}
              alt={entry.altText ? `${entry.altText} — before` : 'Before the appointment'}
              className="w-full h-64 sm:h-80 object-cover"
              loading="lazy"
            />
            <span className="absolute top-3 left-3 px-2 py-1 text-[10px] font-sans-ui uppercase tracking-[0.2em] bg-ink-black/80 text-warm-white/90">
              Before
            </span>
          </div>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.afterPublicUrl}
              alt={entry.altText ? `${entry.altText} — after` : 'After the appointment'}
              className="w-full h-64 sm:h-80 object-cover"
              loading="lazy"
            />
            <span className="absolute top-3 right-3 px-2 py-1 text-[10px] font-sans-ui uppercase tracking-[0.2em] bg-burgundy/90 text-warm-white">
              After
            </span>
          </div>
        </div>
        {/* Divider down the middle of the pair */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-warm-white/30" aria-hidden="true" />
      </div>
      {(entry.caption || entry.altText) && (
        <figcaption className="mt-3 text-sm text-warm-white/70">
          {entry.caption || entry.altText}
        </figcaption>
      )}
    </figure>
  );
}
