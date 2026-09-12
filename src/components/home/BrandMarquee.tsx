import { Reveal } from './Reveal';

const WORDS = ['LASHES', 'BROWS', 'BADDIES', 'LAGOS'];

/**
 * Brand marquee (§19): oversized tracked words with ✦ separators, continuous
 * slow CSS scroll. Pure CSS (no marquee package), pauses on hover, and stops
 * entirely under prefers-reduced-motion via the globals.css rule.
 */
export default function BrandMarquee() {
  const strip = (keyPrefix: string) => (
    <div className="flex shrink-0 items-center" aria-hidden={keyPrefix === 'b'}>
      {WORDS.concat(WORDS).map((word, i) => (
        <span key={`${keyPrefix}-${i}`} className="flex items-center">
          <span className="font-editorial px-6 text-6xl font-semibold tracking-tight text-warm-white md:px-10 md:text-8xl">
            {word}
          </span>
          <span className="text-2xl text-burgundy-lifted md:text-3xl" aria-hidden="true">
            ✦
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <Reveal className="relative overflow-hidden border-y border-white/10 bg-ink-black py-6 md:py-8">
      <div className="marquee-track">
        {strip('a')}
        {strip('b')}
      </div>
    </Reveal>
  );
}
