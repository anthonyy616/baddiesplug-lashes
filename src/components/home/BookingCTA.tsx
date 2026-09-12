import CtaLink from './CtaLink';
import { Reveal, MaskedLines } from './Reveal';
import FloatHeading from './FloatHeading';
import { PulsingCta } from './PulsingCta';

/**
 * Booking CTA (§30): full-bleed deep-burgundy block, enormous editorial type,
 * single conversion action routing into the existing /booking flow. The
 * headline gets JS-driven movement (scroll parallax + idle float) and the
 * white "Book Your Appointment" button runs a JS attention loop: grows up to
 * 75% larger, shakes in place, then shrinks back to its default size.
 */
export default function BookingCTA() {
  return (
    <section className="relative overflow-hidden bg-wine text-warm-white">
      {/* Faint silk echo ties this block back to the hero (§5: sections flow) */}
      <div
        className="silk-layer silk-2 !opacity-30"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 md:py-36 lg:px-8">
        <Reveal>
          <p className="font-sans-ui mb-6 text-xs tracking-[0.35em] uppercase text-rose-muted">
            No waiting. No excuses.
          </p>
        </Reveal>

        <FloatHeading>
          <h2
            className="font-editorial font-semibold leading-[0.95] tracking-tight"
            style={{ fontSize: 'clamp(3rem, 9vw, 9rem)' }}
          >
            <MaskedLines lines={['READY TO GET', 'LASHED?']} textColor="text-warm-white" />
          </h2>
        </FloatHeading>

        <Reveal delay={0.2}>
          <p className="font-sans-ui mx-auto mt-6 max-w-md text-sm md:text-base text-warm-white/70">
            Your next set is waiting.
          </p>
          <div className="mt-10 flex justify-center">
            <PulsingCta>
              <CtaLink href="/booking" variant="light">
                Book Your Appointment
              </CtaLink>
            </PulsingCta>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
