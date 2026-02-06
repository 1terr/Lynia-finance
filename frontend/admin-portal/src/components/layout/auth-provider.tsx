'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth-store';
import type { AdminUser } from '@/types/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Fetch admin profile from admin_users table
          const { data: adminUser } = await supabase
            .from('admin_users')
            .select('*')
            .eq('id', user.id)
            .eq('is_active', true)
            .single();

          if (adminUser) {
            setUser(adminUser as AdminUser);
          } else {
            // User exists in auth but not in admin_users or is inactive
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          router.push('/login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, setUser, setLoading]);

  return <>{children}</>;
}
