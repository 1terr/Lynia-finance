import { create } from 'zustand';
import type { AdminUser, Permission } from '@/types/auth';
import { ROLE_PERMISSIONS } from '@/types/auth';

interface AuthState {
  user: AdminUser | null;
  isLoading: boolean;
  setUser: (user: AdminUser | null) => void;
  setLoading: (loading: boolean) => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    const perms = ROLE_PERMISSIONS[user.role];
    if (!perms) return false;
    return perms.includes(permission);
  },
  hasAnyPermission: (permissions) => {
    const { user } = get();
    if (!user) return false;
    const perms = ROLE_PERMISSIONS[user.role];
    if (!perms) return false;
    return permissions.some((p) => perms.includes(p));
  },
}));
