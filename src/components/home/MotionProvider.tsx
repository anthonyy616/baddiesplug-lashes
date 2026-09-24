'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';

type ReducedMotionContextValue = boolean;

const ReducedMotionContext = createContext<ReducedMotionContextValue>(false);

/**
 * Reads prefers-reduced-motion once (Motion re-renders if the OS setting
 * changes) and shares it with non-Motion effects (marquee pause, lash SVG).
 * Wraps the whole homepage; costs one provider.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion() ?? false;

  const value = useMemo(() => reduced, [reduced]);

  return (
    <ReducedMotionContext.Provider value={value}>
      {children}
    </ReducedMotionContext.Provider>
  );
}

/** True when the visitor asked the OS to reduce motion. */
export function useHomeReducedMotion(): boolean {
  return useContext(ReducedMotionContext);
}
