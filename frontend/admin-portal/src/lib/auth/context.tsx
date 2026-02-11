'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { AdminUser, PermissionAction } from '@/types';
import { isValidAdminRole } from '@/types/auth';
import { hasPermission } from './permissions';

interface AuthContextValue {
  user: AdminUser | null;
  supabaseUser: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  checkPermission: (resource: string, action: PermissionAction) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const fetchAdminProfile = useCallback(
    async (userId: string): Promise<AdminUser | null> => {
      // MED-06: Explicit column list instead of select('*')
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, email, first_name, last_name, role, is_active, department, last_login_at, login_count, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (error || !data) return null;

      // MED-02: Runtime validation of role from database
      if (!isValidAdminRole(data.role)) return null;

      return data as AdminUser;
    },
    [supabase]
  );

  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setSupabaseUser(user);
          const profile = await fetchAdminProfile(user.id);
          setAdminUser(profile);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setSupabaseUser(session.user);
        const profile = await fetchAdminProfile(session.user.id);
        setAdminUser(profile);
      } else if (event === 'SIGNED_OUT') {
        setSupabaseUser(null);
        setAdminUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchAdminProfile]);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    router.refresh();
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const checkPermission = (
    resource: string,
    action: PermissionAction
  ): boolean => {
    if (!adminUser) return false;
    return hasPermission(adminUser.role, resource, action);
  };

  return (
    <AuthContext.Provider
      value={{
        user: adminUser,
        supabaseUser,
        isLoading,
        signIn,
        signOut,
        checkPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
