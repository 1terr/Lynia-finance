'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`).catch(() => {
        // Service worker registration failed - non-critical, ignore silently
      });
    }
  }, []);

  return null;
}
