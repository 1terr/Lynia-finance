'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function usePageTiming() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Perf] ${pathname} ${entry.entryType}: ${entry.startTime.toFixed(0)}ms`);
        }

        // In production, beacon metrics to analytics endpoint
        if (process.env.NODE_ENV === 'production' && 'sendBeacon' in navigator) {
          navigator.sendBeacon(
            '/api/v1/analytics/vitals',
            JSON.stringify({
              name: entry.entryType,
              value: entry.startTime,
              page: pathname,
              timestamp: new Date().toISOString(),
            })
          );
        }
      }
    });

    try {
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // LCP observer not supported in this browser
    }

    return () => observer.disconnect();
  }, [pathname]);
}
