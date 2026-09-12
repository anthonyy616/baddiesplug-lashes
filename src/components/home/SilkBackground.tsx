'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Signature burgundy silk background (§14-18).
 * - Layered CSS gradients drifting on 22-30s cycles (§15)
 * - 3.5% grain overlay (§17)
 * - Optional small cursor glow, fine-pointer desktops only, 8-25px range (§18)
 * - Fully static under prefers-reduced-motion (§42)
 * Pure CSS/SVG — no video, no particles (§52).
 */
export default function SilkBackground() {
  const glowRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Cursor glow: rAF-throttled, ±12px max drift. Desktop fine pointers only.
  useEffect(() => {
    if (reduced) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const glow = glowRef.current;
    const stage = stageRef.current;
    if (!glow || !stage) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;

    const onMove = (e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5;

      targetX = Math.max(-12, Math.min(12, nx * 24));
      targetY = Math.max(-12, Math.min(12, ny * 24));

      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          glow.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
          stage.dataset.cursorActive = 'true';
        });
      }
    };

    const onLeave = () => {
      stage.dataset.cursorActive = 'false';
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <div ref={stageRef} className="silk-stage" aria-hidden="true">
      <div className="silk-base" />
      <div className="silk-layer silk-1" />
      <div className="silk-layer silk-2" />
      <div className="silk-layer silk-3" />
      <div ref={glowRef} className="silk-cursor-glow" />
      <div className="grain-overlay" />
    </div>
  );
}
