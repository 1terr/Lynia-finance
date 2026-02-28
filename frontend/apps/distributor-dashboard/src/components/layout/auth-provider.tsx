'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const distributor = useAuthStore((s) => s.distributor);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show loading spinner while initial auth check is in progress
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Auth check complete but no valid distributor -- redirect to login.
  if (!distributor) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  return <>{children}</>;
}
