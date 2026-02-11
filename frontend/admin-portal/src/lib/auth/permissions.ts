/**
 * Permission helpers using the canonical ROLE_PERMISSIONS from types/auth.ts (HIGH-02 fix).
 * No longer uses wildcard '*' -- all roles have explicit permission lists.
 */
import { ROLE_PERMISSIONS, type AdminRole, type Permission } from '@/types/auth';
import type { PermissionAction } from '@/types';

export function hasPermission(
  userRole: AdminRole,
  resource: string,
  action: PermissionAction
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return false;

  return permissions.includes(`${resource}:${action}` as Permission);
}

export function hasAnyPermission(
  userRole: AdminRole,
  checks: { resource: string; action: PermissionAction }[]
): boolean {
  return checks.some((check) =>
    hasPermission(userRole, check.resource, check.action)
  );
}

export function getRoleDisplayName(role: AdminRole): string {
  const names: Record<AdminRole, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    operations_manager: 'Operations Manager',
    customer_support: 'Customer Support',
    finance_team: 'Finance Team',
    kyc_reviewer: 'KYC Reviewer',
    inventory_manager: 'Inventory Manager',
    reports_viewer: 'Reports Viewer',
  };
  return names[role] ?? role;
}
