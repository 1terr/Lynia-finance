'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
            router.push('/login');
            return;
          }
        } else {
          // No authenticated user — redirect to login
          router.push('/login');
          return;
        }
      } catch {
        // Session expired or invalid — redirect to login
        router.push('/login');
        return;
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
          router.push('/login');
        }
      });
      subscription = data.subscription;
    } catch {
      // Supabase client unavailable -- auth listener not registered
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, [router, setDistributor, setLoading]);

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
