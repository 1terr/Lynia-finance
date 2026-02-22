'use client';

import { useEffect } from 'react';
import { getSession, isCognitoConfigured } from '@lynia/auth';
import { buildDistributorFromSession } from '@lynia/auth';
import { useAuthStore } from '@/lib/store/auth-store';

const DEMO_SESSION_KEY = 'lynia-demo-distributor';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const distributor = useAuthStore((s) => s.distributor);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setDistributor = useAuthStore((s) => s.setDistributor);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    async function loadUser() {
      // Demo mode: restore session from sessionStorage
      if (!isCognitoConfigured()) {
        try {
          const stored = sessionStorage.getItem(DEMO_SESSION_KEY);
          if (stored) {
            setDistributor(JSON.parse(stored));
          }
        } catch { /* private browsing or corrupt data */ }
        setLoading(false);
        return;
      }

      try {
        const session = await getSession();

        if (session && session.isValid()) {
          const profile = buildDistributorFromSession(session);
          setDistributor(profile);
        }
      } catch {
        // Session expired or invalid -- redirect handled by render gate
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [setDistributor, setLoading]);

  // Show loading spinner while initial auth check is in progress
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Auth check complete but no valid distributor -- redirect to login.
  // Uses window.location for a hard redirect because Next.js middleware does
  // not run in static exports (output: 'export'), so router.push alone could
  // leave the spinner stuck if client-side navigation stalls.
  if (!distributor) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  return <>{children}</>;
}
