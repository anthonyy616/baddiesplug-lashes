'use client';

import { useRef, type ReactNode } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'motion/react';

/**
 * Wraps the booking headline in JS-driven movement (§30):
 * - scroll parallax: the block drifts up (~60px total) and tilts slightly as
 *   the section crosses the viewport (rAF-batched via Motion's scroll machinery)
 * - idle float: a slow, small x/y sway so the headline never sits perfectly
 *   still while on screen
 * - everything collapses to a static block under prefers-reduced-motion
 */
export default function FloatHeading({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Parallax driven by scroll position (JS, rAF-batched by Motion).
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const tilt = useTransform(scrollYProgress, [0, 0.5, 1], [-1.5, 0, 1.5]);

  // Idle float: slow loop so it "moves around" even when the user stops scrolling.
  const float = reduced
    ? {}
    : {
        animate: { x: [0, 10, -8, 0], y: [0, -8, 6, 0] },
        transition: { duration: 9, repeat: Infinity, ease: 'easeInOut' as const },
      };

  return (
    <motion.div ref={ref} style={reduced ? undefined : { y: parallaxY, rotate: tilt }}>
      <motion.div {...float}>
        {children}
      </motion.div>
    </motion.div>
  );
}
