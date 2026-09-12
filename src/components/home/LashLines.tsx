'use client';

import { useReducedMotion } from 'motion/react';

/**
 * Abstract lash curves (§16): four bezier strokes suggesting lashes, drawn via
 * stroke-dashoffset on a slow alternating cycle at low opacity. Positioned
 * behind hero content; hidden on mobile (§41) and frozen under reduced motion
 * (§42). Deliberately abstract — not an eye illustration.
 */
export default function LashLines({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <svg
      viewBox="0 0 400 260"
      className={`lash-svg pointer-events-none absolute ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path
        className={`lash-path ${reduced ? '' : 'lash-path-delay-1'}`}
        d="M20 240 C 70 120, 120 80, 150 200"
      />
      <path
        className="lash-path"
        d="M120 250 C 180 100, 240 70, 270 210"
      />
      <path
        className={`lash-path ${reduced ? '' : 'lash-path-delay-2'}`}
        d="M230 255 C 300 90, 350 80, 380 220"
      />
      <path
        className={`lash-path ${reduced ? '' : 'lash-path-delay-3'}`}
        d="M40 120 C 90 60, 140 50, 170 110"
      />
    </svg>
  );
}
