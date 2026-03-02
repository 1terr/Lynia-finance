'use client';

import { useSessionTimeout } from '@/lib/hooks/use-session-timeout';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Renders the session timeout warning dialog.
 * Signs the user out after 15 minutes of inactivity,
 * with a warning shown at 13 minutes.
 */
export function SessionTimeoutWrapper() {
  const { showWarning, remainingSeconds, dismiss } = useSessionTimeout();

  if (!showWarning) return null;

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/20 p-3 mb-3">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
          <h3 className="text-base font-semibold mb-1">Session Expiring</h3>
          <p className="text-sm text-muted-foreground mb-3">
            You&apos;ll be signed out in{' '}
            <span className="font-semibold text-foreground tabular-nums">
              {mins}:{secs.toString().padStart(2, '0')}
            </span>{' '}
            due to inactivity.
          </p>
          <Button size="sm" onClick={dismiss} className="w-full">
            Stay Signed In
          </Button>
        </div>
      </div>
    </div>
  );
}
