'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import type { Permission } from '@/types/auth';

export function usePermission(permission: Permission): boolean {
  return useAuthStore((state) => state.hasPermission(permission));
}

export function useAnyPermission(permissions: Permission[]): boolean {
  return useAuthStore((state) => state.hasAnyPermission(permissions));
}

export function useAdminUser() {
  return useAuthStore((state) => state.user);
}

export function useAdminRole() {
  return useAuthStore((state) => state.user?.role ?? null);
}
