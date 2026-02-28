'use client';

import { useSessionTimeout } from '@/lib/hooks/use-session-timeout';

/**
 * Invisible component that activates the session timeout hook.
 * Signs the user out after 30 minutes of inactivity.
 */
export function SessionTimeoutWrapper() {
  useSessionTimeout();
  return null;
}
