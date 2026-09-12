'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Generics note: pass the element type at the call site, e.g.
 * `useInView<HTMLDivElement>()`, so the ref matches the attached node.
 */

/**
 * Thin IntersectionObserver wrapper used instead of whileInView for content
 * that is offset by a transform inside an overflow-hidden ancestor. Chromium's
 * IO computes visibility after ancestor clipping, so an element translated to
 * y:110% inside overflow:hidden reports isIntersecting=false forever — whileInView
 * on the masked line never fires and the headline stays hidden. Observing the
 * unclipped mask wrapper avoids that broken geometry entirely.
 *
 * Deliberately cheap: the callback only runs when intersection status flips
 * (threshold 0), so cost is one observer + one callback per element.
 */
export function useInView<T extends HTMLElement = HTMLElement>({
  once = true,
  margin = '0px',
}: {
  once?: boolean;
  margin?: string;
} = {}) {
  const ref = useRef<T | null>(null) as RefObject<T | null>;
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      // No IntersectionObserver support — show content rather than hide it.
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) {
              observer.disconnect();
            }
            break;
          }
        }
      },
      { rootMargin: margin, threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once, margin]);

  return { ref, inView };
}
