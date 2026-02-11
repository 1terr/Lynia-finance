'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
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
          const adminUser = await fetchAdminProfile(supabase, user.id);
          if (adminUser) {
            setUser(adminUser);
          } else {
            // User exists in auth but not in admin_users, is inactive, or has invalid role
            await supabase.auth.signOut();
            router.push('/login');
          }
        }
      } catch {
        // Session expired or invalid
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    // Listen for auth state changes
    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const adminUser = await fetchAdminProfile(supabase, session.user.id);
          if (adminUser) {
            setUser(adminUser);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
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
  }, [router, setUser, setLoading]);

  return <>{children}</>;
}
