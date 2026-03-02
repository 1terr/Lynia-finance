'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';

/** Session timeout: 15 minutes of inactivity */
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
/** Warning shown 2 minutes before timeout */
const WARNING_BEFORE_MS = 2 * 60 * 1000;

/** Events that indicate user activity */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
];

/**
 * Hook that warns and signs users out after inactivity.
 * Shows a warning dialog at 13min, signs out at 15min.
 * Returns { showWarning, remainingSeconds, dismiss } for the UI.
 */
export function useSessionTimeout(timeoutMs = SESSION_TIMEOUT_MS) {
  const signOutUser = useAuthStore((s) => s.signOutUser);
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiresAtRef = useRef(Date.now() + timeoutMs);

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const handleTimeout = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    signOutUser();
    window.location.href = '/login?reason=timeout';
  }, [signOutUser, clearAllTimers]);

  const resetTimer = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    expiresAtRef.current = Date.now() + timeoutMs;

    // Warning timer: fires WARNING_BEFORE_MS before timeout
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(Math.ceil(WARNING_BEFORE_MS / 1000));
      // Start countdown
      countdownRef.current = setInterval(() => {
        const left = Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000));
        setRemainingSeconds(left);
        if (left <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      }, 1000);
    }, timeoutMs - WARNING_BEFORE_MS);

    // Actual timeout
    timerRef.current = setTimeout(handleTimeout, timeoutMs);
  }, [handleTimeout, timeoutMs, clearAllTimers]);

  // Dismissing the warning resets the inactivity timer
  const dismiss = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      clearAllTimers();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [resetTimer, clearAllTimers]);

  return { showWarning, remainingSeconds, dismiss };
}
