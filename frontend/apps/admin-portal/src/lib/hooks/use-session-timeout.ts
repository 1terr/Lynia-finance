'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useToast } from '@/hooks/use-toast';

/** Session timeout in milliseconds (30 minutes of inactivity) */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Warning shown 5 minutes before timeout */
const WARNING_BEFORE_MS = 5 * 60 * 1000;

/** Events that indicate user activity */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
];

/**
 * Hook that signs users out after a period of inactivity.
 * Shows a warning toast 5 minutes before session expires.
 * Resets the timer on mouse, keyboard, scroll, and touch events.
 */
export function useSessionTimeout(timeoutMs = SESSION_TIMEOUT_MS) {
  const router = useRouter();
  const signOutUser = useAuthStore((s) => s.signOutUser);
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningShownRef = useRef(false);

  const handleTimeout = useCallback(() => {
    signOutUser();
    router.push('/login');
  }, [router, signOutUser]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    warningShownRef.current = false;

    // Set warning timer (fires 5 min before timeout)
    const warningDelay = timeoutMs - WARNING_BEFORE_MS;
    if (warningDelay > 0) {
      warningRef.current = setTimeout(() => {
        if (!warningShownRef.current) {
          warningShownRef.current = true;
          toast({
            variant: 'warning',
            title: 'Session expiring soon',
            description: 'Your session will expire in 5 minutes due to inactivity. Move your mouse or press a key to stay signed in.',
          });
        }
      }, warningDelay);
    }

    // Set actual timeout
    timerRef.current = setTimeout(handleTimeout, timeoutMs);
  }, [handleTimeout, timeoutMs, toast]);

  useEffect(() => {
    resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [resetTimer]);
}
