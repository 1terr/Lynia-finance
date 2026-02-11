'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth-store';
import { type AdminUser, isValidAdminRole } from '@/types/auth';

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
          // Fetch admin profile with explicit columns (MED-06: avoid select('*'))
          const { data: adminUser } = await supabase
            .from('admin_users')
            .select('id, email, first_name, last_name, role, is_active, department, last_login_at, login_count, created_at, updated_at')
            .eq('id', user.id)
            .eq('is_active', true)
            .single();

          // MED-02: Runtime validation of admin role from database
          if (adminUser && isValidAdminRole(adminUser.role)) {
            setUser(adminUser as AdminUser);
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
