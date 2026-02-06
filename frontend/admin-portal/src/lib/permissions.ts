import type { AdminRole } from '@/types';

type Permission =
  | 'customers:read'
  | 'customers:write'
  | 'loans:read'
  | 'loans:write'
  | 'loans:approve'
  | 'payments:read'
  | 'payments:write'
  | 'payments:reconcile'
  | 'devices:read'
  | 'devices:write'
  | 'devices:lock'
  | 'kyc:read'
  | 'kyc:review'
  | 'reports:read'
  | 'reports:export'
  | 'admin_users:read'
  | 'admin_users:write'
  | 'settings:read'
  | 'settings:write';

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [
    'customers:read', 'customers:write',
    'loans:read', 'loans:write', 'loans:approve',
    'payments:read', 'payments:write', 'payments:reconcile',
    'devices:read', 'devices:write', 'devices:lock',
    'kyc:read', 'kyc:review',
    'reports:read', 'reports:export',
    'admin_users:read', 'admin_users:write',
    'settings:read', 'settings:write',
  ],
  admin: [
    'customers:read', 'customers:write',
    'loans:read', 'loans:write', 'loans:approve',
    'payments:read', 'payments:write', 'payments:reconcile',
    'devices:read', 'devices:write', 'devices:lock',
    'kyc:read', 'kyc:review',
    'reports:read', 'reports:export',
    'settings:read',
  ],
  operations_manager: [
    'customers:read', 'customers:write',
    'loans:read', 'loans:write', 'loans:approve',
    'payments:read', 'payments:write',
    'devices:read', 'devices:write', 'devices:lock',
    'kyc:read', 'kyc:review',
    'reports:read', 'reports:export',
  ],
  finance_team: [
    'customers:read',
    'loans:read',
    'payments:read', 'payments:write', 'payments:reconcile',
    'reports:read', 'reports:export',
  ],
  kyc_reviewer: [
    'customers:read',
    'kyc:read', 'kyc:review',
  ],
  customer_support: [
    'customers:read',
    'loans:read',
    'payments:read',
    'devices:read',
  ],
  inventory_manager: [
    'devices:read', 'devices:write',
  ],
  reports_viewer: [
    'reports:read',
  ],
};

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
