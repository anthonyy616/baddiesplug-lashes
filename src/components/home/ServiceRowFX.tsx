'use client';

import { useEffect, useRef } from 'react';

/**
 * Adds the cursor-follow behavior to the desktop service-row preview images
 * (§21). Pure enhancement: rows work fine without JS (image simply sits in
 * its default position while hovered). rAF-throttled; no-ops on touch devices
 * since the rows only hover there on fine pointers.
 */
export default function ServiceRowFX() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let active: HTMLElement | null = null;

    const onMove = (e: MouseEvent) => {
      const row = (e.currentTarget as HTMLElement).closest<HTMLElement>('.service-row');
      if (!row) return;
      active = row;
      const rect = row.getBoundingClientRect();
      targetX = e.clientX - rect.left - rect.width / 2;
      targetY = e.clientY - rect.top - rect.height / 2;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const tick = () => {
      raf = 0;
      if (!active) return;
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      const img = active.querySelector<HTMLElement>('.service-row-img');
      if (img) {
        img.style.translate = `${currentX}px ${currentY}px`;
      }
      // Keep easing toward the target while the pointer is still moving.
      if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
        raf = requestAnimationFrame(tick);
      }
    };

    const onLeave = (e: MouseEvent) => {
      const row = (e.currentTarget as HTMLElement);
      active = null;
      const img = row.querySelector<HTMLElement>('.service-row-img');
      if (img) img.style.translate = '0px 0px';
      currentX = 0;
      currentY = 0;
      targetX = 0;
      targetY = 0;
    };

    const rows = root.querySelectorAll<HTMLElement>('.service-row');
    rows.forEach((row) => {
      row.addEventListener('mousemove', onMove, { passive: true });
      row.addEventListener('mouseleave', onLeave);
    });

    return () => {
      rows.forEach((row) => {
        row.removeEventListener('mousemove', onMove);
        row.removeEventListener('mouseleave', onLeave);
      });
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={rootRef} className="contents" />;
}
