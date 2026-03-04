'use client';

import { useState, useEffect } from 'react';

type ConnectionQuality = 'good' | 'slow' | 'offline';

interface NetworkInformation {
  effectiveType: string;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

/**
 * Tracks connection quality using the Network Information API (Chrome/Android)
 * and the online/offline browser events.
 *
 * Returns:
 * - 'good' — normal connectivity
 * - 'slow' — 2G or slow-2g effective connection type
 * - 'offline' — browser reports no connectivity
 */
export function useConnectionQuality(): ConnectionQuality {
  const [quality, setQuality] = useState<ConnectionQuality>(() => {
    if (typeof navigator === 'undefined') return 'good';
    if (!navigator.onLine) return 'offline';
    const conn = (navigator as unknown as { connection?: NetworkInformation }).connection;
    if (conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) {
      return 'slow';
    }
    return 'good';
  });

  useEffect(() => {
    const update = () => {
      if (!navigator.onLine) {
        setQuality('offline');
        return;
      }
      const conn = (navigator as unknown as { connection?: NetworkInformation }).connection;
      if (conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) {
        setQuality('slow');
      } else {
        setQuality('good');
      }
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    // Network Information API change event (Chrome/Android only)
    const conn = (navigator as unknown as { connection?: NetworkInformation }).connection;
    if (conn) {
      conn.addEventListener('change', update);
    }

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      if (conn) {
        conn.removeEventListener('change', update);
      }
    };
  }, []);

  return quality;
}
