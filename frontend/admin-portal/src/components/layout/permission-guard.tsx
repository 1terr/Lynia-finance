'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import type { Permission } from '@/types/auth';

interface PermissionGuardProps {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  if (permission) {
    return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
  }

  if (permissions) {
    if (requireAll) {
      const hasAll = permissions.every((p) => hasPermission(p));
      return hasAll ? <>{children}</> : <>{fallback}</>;
    }
    return hasAnyPermission(permissions) ? <>{children}</> : <>{fallback}</>;
  }

  // MED-08: Default to deny when no permission is specified (fail-closed)
  return <>{fallback}</>;
}
