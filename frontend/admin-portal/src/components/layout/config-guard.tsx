'use client';

import { useState, useEffect } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Blocks child rendering when Supabase environment variables are missing.
 *
 * Uses a post-hydration state check to avoid SSR/client mismatches:
 *   - Server & first client render: always renders children (matching SSR)
 *   - After mount: checks config and shows error if missing
 */
export function ConfigGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setChecked(true);
  }, []);

  if (checked && !isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center max-w-md p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 font-bold text-xl dark:bg-orange-950 dark:text-orange-400">
            !
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Service Unavailable
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            The admin portal is not properly configured. Please contact your
            system administrator to set the required environment variables.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
