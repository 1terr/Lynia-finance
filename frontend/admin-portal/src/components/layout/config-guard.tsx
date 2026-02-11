'use client';

import { isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Blocks child rendering when Supabase environment variables are missing.
 *
 * Placed in the root layout so that no downstream component ever receives a
 * null Supabase client.  During SSR / static export this always renders
 * children (config isn't needed until the browser hydrates).
 */
export function ConfigGuard({ children }: { children: React.ReactNode }) {
  if (typeof window !== 'undefined' && !isSupabaseConfigured()) {
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
