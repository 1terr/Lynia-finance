'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { hasPermission } from './permissions';
import type { PermissionAction } from '@/types';

interface UseAuthReturn {
  user: ReturnType<typeof useAuthStore.getState>['user'];
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
  const storeSignIn = useAuthStore((s) => s.signIn);
  const signOutUser = useAuthStore((s) => s.signOutUser);
  const router = useRouter();

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      const result = await storeSignIn(email, password);
      if (!result.error) {
        router.refresh();
      }
      return result;
    },
    [router, storeSignIn],
  );

  const signOut = useCallback(async () => {
    signOutUser();
    router.push('/login');
  }, [router, signOutUser]);

  const checkPermission = useCallback(
    (resource: string, action: PermissionAction): boolean => {
      if (!user) return false;
      return hasPermission(user.role, resource, action);
    },
    [user],
  );

  return { user, isLoading, signIn, signOut, checkPermission };
}
