'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { createClient } from '@/lib/supabase/client';
import { hasPermission } from './permissions';
import type { PermissionAction } from '@/types';

interface UseAuthReturn {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  supabaseUser: null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  checkPermission: (resource: string, action: PermissionAction) => boolean;
}

/**
 * useAuth hook backed by the Zustand auth store.
 *
 * The Zustand store is populated by the <AuthProvider> in the dashboard layout
 * (components/layout/auth-provider.tsx).  This hook provides a convenient API
 * surface (signIn, signOut, checkPermission) on top of the store state.
 */
export function useAuth(): UseAuthReturn {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // MED-01: Generic error to avoid leaking account information
          return { error: 'Invalid email or password' };
        }

        router.refresh();
        return {};
      } catch {
        return { error: 'An unexpected error occurred' };
      }
    },
    [router],
  );

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Best-effort sign out -- clear local state regardless
    }
    setUser(null);
    router.push('/login');
  }, [router, setUser]);

  const checkPermission = useCallback(
    (resource: string, action: PermissionAction): boolean => {
      if (!user) return false;
      return hasPermission(user.role, resource, action);
    },
    [user],
  );

  return { user, supabaseUser: null, isLoading, signIn, signOut, checkPermission };
}
