'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';

/** Session timeout in milliseconds (30 minutes of inactivity) */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Events that indicate user activity */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
];

/**
 * Hook that signs users out after a period of inactivity.
 * Resets the timer on mouse, keyboard, scroll, and touch events.
 */
export function useSessionTimeout(timeoutMs = SESSION_TIMEOUT_MS) {
  const signOutUser = useAuthStore((s) => s.signOutUser);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTimeout = useCallback(() => {
    signOutUser();
    window.location.href = '/login';
  }, [signOutUser]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(handleTimeout, timeoutMs);
  }, [handleTimeout, timeoutMs]);

  useEffect(() => {
    resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [resetTimer]);
}
