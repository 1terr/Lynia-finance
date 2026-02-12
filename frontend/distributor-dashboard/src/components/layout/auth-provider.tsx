'use client';

import { useEffect } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
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

/** Hard redirect — works reliably in static exports where router.push can stall. */
function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const distributor = useAuthStore((s) => s.distributor);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setDistributor = useAuthStore((s) => s.setDistributor);
  const setLoading = useAuthStore((s) => s.setLoading);

  // When Supabase is not configured (local dev without env vars), skip auth
  // entirely and render children so the mock-data flow keeps working.
  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    if (!supabaseReady) {
      setLoading(false);
      return;
    }

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
            redirectToLogin();
            return;
          }
        } else {
          // No authenticated user — redirect to login
          redirectToLogin();
          return;
        }
      } catch {
        // Session expired or invalid — redirect to login
        redirectToLogin();
        return;
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    // Listen for auth state changes
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchDistributorProfile(supabase, session.user.id);
        if (profile) {
          setDistributor(profile);
        }
      } else if (event === 'SIGNED_OUT') {
        setDistributor(null);
        redirectToLogin();
      }
    });
    subscription = data.subscription;

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabaseReady, setDistributor, setLoading]);

  // When Supabase is not configured, skip the auth gate entirely
  if (!supabaseReady) {
    return <>{children}</>;
  }

  // Gate rendering: show loading spinner until auth check completes
  if (isLoading || !distributor) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
