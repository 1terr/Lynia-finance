'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'lynia-offline-queue';

interface QueuedSubmission {
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
}

/**
 * Offline submission queue. When a handover submission fails due to
 * network error, the payload is saved to localStorage. On reconnect,
 * the queue auto-retries. A badge count is exposed for the UI.
 */
export function useOfflineQueue(
  submitFn: (payload: Record<string, unknown>) => Promise<unknown>,
) {
  const [queue, setQueue] = useState<QueuedSubmission[]>([]);
  const [processing, setProcessing] = useState(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setQueue(JSON.parse(stored));
      }
    } catch {
      // ignore corrupt data
    }
  }, []);

  // Persist queue to localStorage on change
  useEffect(() => {
    if (queue.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
  }, [queue]);

  const enqueue = useCallback((payload: Record<string, unknown>) => {
    const entry: QueuedSubmission = {
      id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      payload,
      createdAt: new Date().toISOString(),
      retries: 0,
    };
    setQueue((prev) => [...prev, entry]);
  }, []);

  const processQueue = useCallback(async () => {
    if (processing || queue.length === 0) return;
    setProcessing(true);

    const remaining: QueuedSubmission[] = [];

    for (const item of queue) {
      try {
        await submitFn(item.payload);
        // Success — don't re-add
      } catch {
        // Still failing — keep in queue with incremented retry
        remaining.push({ ...item, retries: item.retries + 1 });
      }
    }

    setQueue(remaining);
    setProcessing(false);
  }, [processing, queue, submitFn]);

  // Auto-retry when coming back online
  useEffect(() => {
    const handler = () => {
      if (queue.length > 0) {
        processQueue();
      }
    };

    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [queue.length, processQueue]);

  const clear = useCallback(() => setQueue([]), []);

  return {
    pendingCount: queue.length,
    processing,
    enqueue,
    processQueue,
    clear,
  };
}
