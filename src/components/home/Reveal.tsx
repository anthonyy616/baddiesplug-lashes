'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useInView } from './useInView';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  /** Stagger index — children of a group can pass 0,1,2… */
  index?: number;
  className?: string;
  /** Reveal once even when scrolling back (cheaper, calmer). */
  once?: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Standard section entrance (§37): opacity 0→1, translateY 30px→0, 0.5–1s.
 * Collapses to a simple fade under prefers-reduced-motion.
 */
export function Reveal({ children, delay = 0, index = 0, className, once = true }: RevealProps) {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>({ once, margin: '0px 0px -10% 0px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 30 }}
      animate={inView ? (reduced ? { opacity: 1 } : { opacity: 1, y: 0 }) : undefined}
      transition={{ duration: 0.7, delay: delay + index * 0.08, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

interface MaskedLinesProps {
  lines: string[];
  className?: string;
  lineClassName?: string;
  delay?: number;
  textColor?: string;
}

/**
 * Editorial masked headline reveal (§36 typography): each line slides up from
 * under an overflow-hidden mask with a slight stagger.
 */
export function MaskedLines({ lines, className = '', lineClassName = '', delay = 0, textColor = '' }: MaskedLinesProps) {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView({ once: true, margin: '0px 0px -8% 0px' });
  const colorStyle: React.CSSProperties = textColor ? { color: 'inherit' } : {};

  return (
    <span ref={ref} className={`block ${textColor} ${className}`}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
          <motion.span
            className={`block will-change-transform ${lineClassName}`}
            style={colorStyle}
            initial={reduced ? { opacity: 0 } : { y: '110%' }}
            animate={inView ? (reduced ? { opacity: 1 } : { y: '0%' }) : undefined}
            transition={{ duration: 0.9, delay: delay + i * 0.12, ease: EASE }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
