import { AdminRole, ROLE_PERMISSIONS, type PermissionAction } from '@/types';

export function hasPermission(
  userRole: AdminRole,
  resource: string,
  action: PermissionAction
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return false;

  // Super admin wildcard
  if (permissions.some((p) => p.resource === '*')) return true;

  const resourcePermission = permissions.find((p) => p.resource === resource);
  return resourcePermission?.actions.includes(action) ?? false;
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
    [AdminRole.SUPER_ADMIN]: 'Super Admin',
    [AdminRole.OPERATIONS_MANAGER]: 'Operations Manager',
    [AdminRole.CUSTOMER_SUPPORT]: 'Customer Support',
    [AdminRole.FINANCE_TEAM]: 'Finance Team',
    [AdminRole.KYC_REVIEWER]: 'KYC Reviewer',
    [AdminRole.INVENTORY_MANAGER]: 'Inventory Manager',
    [AdminRole.REPORTS_VIEWER]: 'Reports Viewer',
  };
  return names[role] ?? role;
}
