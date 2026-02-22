/**
 * Permission utilities using the canonical ROLE_PERMISSIONS from types/auth.ts.
 * This file no longer defines its own permission map (HIGH-02 fix).
 */
import type { AdminRole, Permission } from '@/types/auth';
import { ROLE_PERMISSIONS } from '@/types/auth';

export type { Permission };

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: AdminRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function canAccessRoute(role: AdminRole, pathname: string): boolean {
  const routePermissions: Record<string, Permission[]> = {
    '/': [],
    '/customers': ['customers:read'],
    '/loans': ['loans:read'],
    '/payments': ['payments:read'],
    '/devices': ['devices:read'],
    '/reports': ['reports:read'],
    '/settings': ['settings:read'],
  };

  const requiredPermissions = routePermissions[pathname];
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  return hasAnyPermission(role, requiredPermissions);
}
