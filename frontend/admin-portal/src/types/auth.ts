export type AdminRole =
  | 'super_admin'
  | 'operations_manager'
  | 'kyc_reviewer'
  | 'finance_team'
  | 'inventory_manager'
  | 'customer_support'
  | 'reports_viewer';

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: AdminRole;
  is_active: boolean;
  department: string | null;
  last_login_at: string | null;
  created_at: string;
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
  | 'notifications:send';

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
