'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Tracks scroll direction for hiding/showing the header on mobile.
 * Returns 'up' or 'down'. Only activates below the `md` breakpoint (768px).
 */
export function useScrollDirection(threshold = 10): 'up' | 'down' {
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // Only activate on mobile-sized screens
    const mql = window.matchMedia('(min-width: 768px)');
    if (mql.matches) return;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - lastY.current) >= threshold) {
          setDirection(y > lastY.current ? 'down' : 'up');
          lastY.current = y;
        }
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return direction;
}
