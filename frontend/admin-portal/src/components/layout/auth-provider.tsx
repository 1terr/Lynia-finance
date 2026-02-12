'use client';

import { useEffect } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth-store';
import { type AdminUser, isValidAdminRole } from '@/types/auth';

/** Fetch and validate admin profile for a given auth user id. */
async function fetchAdminProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<AdminUser | null> {
  try {
    // MED-06: Explicit column list instead of select('*')
    const { data } = await supabase
      .from('admin_users')
      .select(
        'id, email, first_name, last_name, role, is_active, department, last_login_at, login_count, created_at, updated_at',
      )
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    // MED-02: Runtime validation of admin role from database
    if (data && isValidAdminRole(data.role)) {
      return data as AdminUser;
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
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  // When Supabase is not configured the ConfigGuard already blocks rendering,
  // but we still guard here to avoid calling methods on a null client.
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
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (authUser) {
          const adminUser = await fetchAdminProfile(supabase, authUser.id);
          if (adminUser) {
            setUser(adminUser);
          } else {
            // User exists in auth but not in admin_users, is inactive, or has invalid role
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
        const adminUser = await fetchAdminProfile(supabase, session.user.id);
        if (adminUser) {
          setUser(adminUser);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        redirectToLogin();
      }
    });
    subscription = data.subscription;

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabaseReady, setUser, setLoading]);

  // Gate rendering: show loading spinner until auth check completes
  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
