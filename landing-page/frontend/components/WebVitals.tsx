'use client';

import { useEffect } from 'react';

/**
 * Reports Core Web Vitals (LCP, FID, CLS, FCP, TTFB) to console in dev
 * and to an analytics endpoint in production.
 *
 * Uses the web-vitals library via dynamic import to avoid adding to the
 * initial bundle. Falls back gracefully if the library is not installed.
 */
export function WebVitals() {
  useEffect(() => {
    import('web-vitals')
      .then(({ onLCP, onFID, onCLS, onFCP, onTTFB }) => {
        const report = (metric: { name: string; value: number; id: string }) => {
          if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.log(`[Web Vital] ${metric.name}: ${metric.value.toFixed(1)}`);
          }

          // In production, send to analytics endpoint via sendBeacon
          if (
            process.env.NODE_ENV === 'production' &&
            typeof navigator.sendBeacon === 'function'
          ) {
            const url = '/api/v1/analytics/vitals';
            const body = JSON.stringify({
              name: metric.name,
              value: metric.value,
              id: metric.id,
              page: window.location.pathname,
            });
            navigator.sendBeacon(url, body);
          }
        };

        onLCP(report);
        onFID(report);
        onCLS(report);
        onFCP(report);
        onTTFB(report);
      })
      .catch(() => {
        // web-vitals not installed — skip silently
      });
  }, []);

  return null;
}
