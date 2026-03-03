'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 60 seconds - data stays fresh for 1 minute
            refetchOnWindowFocus: false, // Don't refetch when window regains focus
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
              return failureCount < 1;
            },
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
