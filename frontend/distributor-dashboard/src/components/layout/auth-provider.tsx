'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth-store';
import type { Distributor } from '@/types/distributor';

/** Fetch distributor profile for the authenticated user. */
async function fetchDistributorProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Distributor | null> {
  try {
    const { data } = await supabase
      .from('distributors')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (data) {
      return data as Distributor;
    }
  } catch {
    // Query failed -- treat as unauthenticated
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const distributor = useAuthStore((s) => s.distributor);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setDistributor = useAuthStore((s) => s.setDistributor);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const supabase = createClient();

    async function loadUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const profile = await fetchDistributorProfile(supabase, user.id);
          if (profile) {
            setDistributor(profile);
          } else {
            // User exists in auth but not in distributors table or inactive
            await supabase.auth.signOut();
          }
        }
      } catch {
        // Session expired or invalid — redirect handled by render gate
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    // Listen for auth state changes
    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchDistributorProfile(supabase, session.user.id);
          if (profile) {
            setDistributor(profile);
          }
        } else if (event === 'SIGNED_OUT') {
          setDistributor(null);
        }
      });
      subscription = data.subscription;
    } catch {
      // Supabase client unavailable -- auth listener not registered
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, [setDistributor, setLoading]);

  // Show loading spinner while initial auth check is in progress
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Auth check complete but no valid distributor — redirect to login.
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
