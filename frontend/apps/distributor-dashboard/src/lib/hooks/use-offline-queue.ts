'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'lynia-offline-queue';
const FAILED_STORAGE_KEY = 'lynia-failed-submissions';
const MAX_RETRIES = 5;

interface QueuedSubmission {
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
}

interface FailedSubmission extends QueuedSubmission {
  failedAt: string;
}

/**
 * Offline submission queue. When a handover submission fails due to
 * network error, the payload is saved to localStorage. On reconnect,
 * the queue auto-retries. After MAX_RETRIES failures, items are moved
 * to a 'failed' state for later review. A badge count is exposed for the UI.
 */
export function useOfflineQueue(
  submitFn: (payload: Record<string, unknown>) => Promise<unknown>,
) {
  const [queue, setQueue] = useState<QueuedSubmission[]>([]);
  const [failedItems, setFailedItems] = useState<FailedSubmission[]>([]);
  const [processing, setProcessing] = useState(false);

  // Load queue and failed items from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setQueue(JSON.parse(stored));
      }
    } catch {
      // ignore corrupt data
    }
    try {
      const storedFailed = localStorage.getItem(FAILED_STORAGE_KEY);
      if (storedFailed) {
        setFailedItems(JSON.parse(storedFailed));
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

  // Persist failed items to localStorage on change
  useEffect(() => {
    if (failedItems.length === 0) {
      localStorage.removeItem(FAILED_STORAGE_KEY);
    } else {
      localStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(failedItems));
    }
  }, [failedItems]);

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
    const newFailed: FailedSubmission[] = [];

    for (const item of queue) {
      try {
        await submitFn(item.payload);
        // Success — don't re-add
      } catch {
        const updatedRetries = item.retries + 1;
        if (updatedRetries >= MAX_RETRIES) {
          // Max retries exceeded — move to failed state
          newFailed.push({
            ...item,
            retries: updatedRetries,
            failedAt: new Date().toISOString(),
          });
        } else {
          // Still within retry limit — keep in queue
          remaining.push({ ...item, retries: updatedRetries });
        }
      }
    }

    if (newFailed.length > 0) {
      setFailedItems((prev) => [...prev, ...newFailed]);
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
  const clearFailed = useCallback(() => setFailedItems([]), []);

  return {
    pendingCount: queue.length,
    failedCount: failedItems.length,
    failedItems,
    processing,
    enqueue,
    processQueue,
    clear,
    clearFailed,
  };
}
