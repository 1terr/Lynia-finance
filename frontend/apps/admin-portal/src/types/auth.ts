export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'operations_manager'
  | 'kyc_reviewer'
  | 'finance_team'
  | 'inventory_manager'
  | 'customer_support'
  | 'reports_viewer';

/** Valid admin roles for runtime validation (MED-02) */
export const ADMIN_ROLES: AdminRole[] = [
  'super_admin',
  'admin',
  'operations_manager',
  'kyc_reviewer',
  'finance_team',
  'inventory_manager',
  'customer_support',
  'reports_viewer',
];

/** Runtime validation guard for admin role values from database */
export function isValidAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRole);
}

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: AdminRole;
  is_active: boolean;
  department: string | null;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
  updated_at: string;
}

export type Permission =
  | 'dashboard:view'
  | 'customers:read'
  | 'customers:write'
  | 'customers:delete'
  | 'loans:read'
  | 'loans:approve'
  | 'loans:reject'
  | 'loans:write'
  | 'kyc:read'
  | 'kyc:approve'
  | 'kyc:reject'
  | 'devices:read'
  | 'devices:write'
  | 'devices:delete'
  | 'devices:lock'
  | 'devices:unlock'
  | 'payments:read'
  | 'payments:reconcile'
  | 'payments:refund'
  | 'reports:read'
  | 'reports:export'
  | 'settings:read'
  | 'settings:write'
  | 'admin_users:read'
  | 'admin_users:write'
  | 'notifications:send';

/**
 * Single source of truth for role-permission mappings.
 * All permission checks across the app MUST reference this definition.
 */
export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [
    'dashboard:view',
    'customers:read', 'customers:write', 'customers:delete',
    'loans:read', 'loans:approve', 'loans:reject', 'loans:write',
    'kyc:read', 'kyc:approve', 'kyc:reject',
    'devices:read', 'devices:write', 'devices:delete', 'devices:lock', 'devices:unlock',
    'payments:read', 'payments:reconcile', 'payments:refund',
    'reports:read', 'reports:export',
    'settings:read', 'settings:write',
    'admin_users:read', 'admin_users:write',
    'notifications:send',
  ],
  admin: [
    'dashboard:view',
    'customers:read', 'customers:write', 'customers:delete',
    'loans:read', 'loans:approve', 'loans:reject', 'loans:write',
    'kyc:read', 'kyc:approve', 'kyc:reject',
    'devices:read', 'devices:write', 'devices:delete', 'devices:lock', 'devices:unlock',
    'payments:read', 'payments:reconcile', 'payments:refund',
    'reports:read', 'reports:export',
    'settings:read',
    'notifications:send',
  ],
  operations_manager: [
    'dashboard:view',
    'customers:read', 'customers:write',
    'loans:read', 'loans:approve', 'loans:reject', 'loans:write',
    'kyc:read', 'kyc:approve', 'kyc:reject',
    'devices:read', 'devices:write', 'devices:lock', 'devices:unlock',
    'payments:read', 'payments:reconcile',
    'reports:read', 'reports:export',
    'notifications:send',
  ],
  kyc_reviewer: [
    'dashboard:view',
    'customers:read',
    'kyc:read', 'kyc:approve', 'kyc:reject',
  ],
  finance_team: [
    'dashboard:view',
    'customers:read',
    'loans:read',
    'payments:read', 'payments:reconcile', 'payments:refund',
    'reports:read', 'reports:export',
  ],
  inventory_manager: [
    'dashboard:view',
    'devices:read', 'devices:write', 'devices:delete',
  ],
  customer_support: [
    'dashboard:view',
    'customers:read',
    'loans:read',
    'kyc:read',
    'payments:read',
    'notifications:send',
  ],
  reports_viewer: [
    'dashboard:view',
    'reports:read', 'reports:export',
  ],
};
