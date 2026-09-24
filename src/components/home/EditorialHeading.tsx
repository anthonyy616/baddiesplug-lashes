import { MaskedLines } from './Reveal';

interface EditorialHeadingProps {
  eyebrow: string;
  lines: string[];
  tone?: 'dark' | 'light';
  align?: 'left' | 'center';
  className?: string;
  eyebrowClassName?: string;
  /**
   * Inline style for the eyebrow. Inline wins over any variant-sorted utility,
   * so use this (not eyebrowClassName) for font-size overrides — Tailwind's
   * CSS sort order makes responsive size utilities unreliable against the
   * shared text-xs/md:text-sm defaults.
   */
  eyebrowStyle?: React.CSSProperties;
  headingClassName?: string;
}

/**
 * Consistent section header: small tracked-out eyebrow + huge editorial
 * headline. `tone` picks text color for dark vs light section backgrounds.
 */
export default function EditorialHeading({
  eyebrow,
  lines,
  tone = 'dark',
  align = 'left',
  className = '',
  eyebrowClassName = '',
  eyebrowStyle,
  headingClassName = '',
}: EditorialHeadingProps) {
  const textColor = tone === 'dark'
    ? 'text-warm-white'
    : 'text-ink-black dark:text-warm-white';

  const eyebrowColor = tone === 'dark'
    ? 'text-rose-muted'
    : 'text-burgundy dark:text-rose-muted';

  // A custom heading color must win over the tone default, so it goes AFTER
  // textColor in the class list (both are plain utilities — order in the
  // string is what decides, since specificity is equal).
  const effectiveHeadingColor = headingClassName
    ? `${textColor} ${headingClassName}`
    : textColor;

  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <p
        className={`font-sans-ui text-xs md:text-sm tracking-[0.35em] uppercase ${eyebrowColor} mb-4 md:mb-6 ${eyebrowClassName}`}
        style={eyebrowStyle}
      >
        {eyebrow}
      </p>
      <h2
        className={`font-editorial font-semibold leading-[0.95] tracking-tight ${effectiveHeadingColor} ${className}`}
        style={{ fontSize: 'clamp(2.5rem, 7vw, 7rem)' }}
      >
        {/* Pass the EFFECTIVE heading color down: MaskedLines' outer span
            applies its own text color, so passing the tone color here would
            repaint the headline after the h2's custom color. */}
        <MaskedLines lines={lines} textColor={effectiveHeadingColor} />
      </h2>
    </div>
  );
}
