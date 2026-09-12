'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * JS attention animation for the white "Book Your Appointment" CTA (§38):
 * 1. grows to 175% of its natural size (i.e. +75%) over ~0.6s
 * 2. stays enlarged and shakes for ~4 seconds
 * 3. shrinks back to exactly its natural size and rests there until the next
 *    cycle (one cycle every 8s once the section is in view)
 *
 * Scale and rotation live on separate nested elements so each gets its own
 * keyframe timing (Motion does not allow a shared `times` across keyframe
 * arrays of different lengths). Under prefers-reduced-motion the button
 * renders unchanged (static).
 */
export function PulsingCta({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [cycle, setCycle] = useState(0);

  // Start the loop once the button is meaningfully in view.
  useEffect(() => {
    if (reduced) return;

    const el = document.getElementById('cta-pulse-anchor');
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  // First cycle fires as soon as the section is visible, then repeats every 8s.
  useEffect(() => {
    if (reduced || !visible) return;
    const interval = setInterval(() => setCycle((c) => c + 1), 8000);
    return () => clearInterval(interval);
  }, [reduced, visible]);

  if (reduced) {
    return <div id="cta-pulse-anchor">{children}</div>;
  }

  return (
    <motion.div
      key={cycle}
      id="cta-pulse-anchor"
      className="inline-block"
      initial={{ scale: 1 }}
      animate={visible ? { scale: [1, 1.75, 1.75, 1] } : { scale: 1 }}
      transition={{ duration: 5.2, times: [0, 0.12, 0.88, 1], ease: 'easeInOut' }}
    >
      <motion.div
        className="inline-block"
        initial={{ rotate: 0 }}
        animate={
          visible
            ? { rotate: [0, -1.5, 1.5, -1.2, 1.2, -0.8, 0.8, -0.4, 0.4, 0] }
            : { rotate: 0 }
        }
        transition={{ delay: 0.62, duration: 3.96, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
