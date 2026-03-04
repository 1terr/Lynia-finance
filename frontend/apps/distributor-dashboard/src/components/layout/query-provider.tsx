'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000, // 5 minutes — show cached data longer on slow networks
            gcTime: 30 * 60_000, // 30 minutes — keep data in cache for page re-visits
            refetchOnWindowFocus: false,
            refetchOnReconnect: true, // Auto-refresh when connectivity returns
            networkMode: 'offlineFirst', // Show cached data immediately when offline
            retry: (failureCount, error) => {
              const msg = error instanceof Error ? error.message : '';
              // Don't retry auth errors, permission errors, or not-found — they won't succeed
              if (
                msg.includes('Authentication required') ||
                msg.includes('Session expired') ||
                msg.includes('permission') ||
                msg.includes('not found') ||
                msg.includes('Not Found')
              ) {
                return false;
              }
              return failureCount < 3; // 3 retries for transient network failures (2G/3G)
            },
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
