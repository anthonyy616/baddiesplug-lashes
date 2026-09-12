import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface CtaLinkProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'light';
  className?: string;
  external?: boolean;
  onClick?: () => void;
}

/**
 * Primary brand CTA (§38): uppercase tracked label + arrow that slides on
 * hover. Solid burgundy, outlined, or light-on-burgundy variants. Minimum 44px
 * touch target.
 */
export default function CtaLink({
  href,
  children,
  variant = 'primary',
  className = '',
  external = false,
  onClick,
}: CtaLinkProps) {
  const base =
    'group/cta inline-flex items-center justify-center gap-3 min-h-[44px] px-7 md:px-9 py-3 ' +
    'font-sans-ui text-sm font-semibold tracking-[0.18em] uppercase transition-colors duration-300';

  const variants: Record<string, string> = {
    primary:
      'bg-burgundy text-white hover:bg-wine ' +
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy',
    outline:
      'border border-warm-white/40 text-warm-white hover:border-warm-white hover:bg-warm-white hover:text-ink-black ' +
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-white',
    light:
      'bg-warm-white text-burgundy hover:bg-white ' +
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-white',
  };

  const arrow =
    'transition-transform duration-300 group-hover/cta:translate-x-1.5 motion-reduce:transition-none motion-reduce:group-hover/cta:translate-x-0';

  const content = (
    <>
      <span>{children}</span>
      <ArrowRight className={arrow} size={18} strokeWidth={1.75} aria-hidden="true" />
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} ${variants[variant]} ${className}`}
        onClick={onClick}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} ${variants[variant]} ${className}`}
      onClick={onClick}
    >
      {content}
    </Link>
  );
}
