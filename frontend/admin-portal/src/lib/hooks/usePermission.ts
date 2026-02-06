'use client';

import { useAuth } from '@/lib/auth/context';
import { hasPermission, hasAnyPermission } from '@/lib/auth/permissions';
import type { PermissionAction } from '@/types';

export function usePermission(
  resource: string,
  action: PermissionAction
): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasPermission(user.role, resource, action);
}

export function useAnyPermission(
  checks: { resource: string; action: PermissionAction }[]
): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasAnyPermission(user.role, checks);
}
