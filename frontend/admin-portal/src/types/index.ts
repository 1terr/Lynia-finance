export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  OPERATIONS_MANAGER = 'operations_manager',
  CUSTOMER_SUPPORT = 'customer_support',
  FINANCE_TEAM = 'finance_team',
  KYC_REVIEWER = 'kyc_reviewer',
  INVENTORY_MANAGER = 'inventory_manager',
  REPORTS_VIEWER = 'reports_viewer',
}

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

export interface Permission {
  resource: string;
  actions: PermissionAction[];
}

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  [AdminRole.SUPER_ADMIN]: [
    { resource: '*', actions: ['create', 'read', 'update', 'delete'] },
  ],
  [AdminRole.OPERATIONS_MANAGER]: [
    { resource: 'customers', actions: ['read', 'update'] },
    { resource: 'loans', actions: ['read', 'update'] },
    { resource: 'devices', actions: ['read', 'update'] },
    { resource: 'handovers', actions: ['create', 'read', 'update'] },
    { resource: 'kyc', actions: ['read', 'update'] },
    { resource: 'payments', actions: ['read'] },
    { resource: 'reports', actions: ['read'] },
  ],
  [AdminRole.CUSTOMER_SUPPORT]: [
    { resource: 'customers', actions: ['read'] },
    { resource: 'loans', actions: ['read'] },
    { resource: 'devices', actions: ['read'] },
    { resource: 'payments', actions: ['read'] },
    { resource: 'kyc', actions: ['read'] },
  ],
  [AdminRole.FINANCE_TEAM]: [
    { resource: 'customers', actions: ['read'] },
    { resource: 'loans', actions: ['read'] },
    { resource: 'payments', actions: ['read', 'update'] },
    { resource: 'reports', actions: ['read'] },
  ],
  [AdminRole.KYC_REVIEWER]: [
    { resource: 'customers', actions: ['read'] },
    { resource: 'kyc', actions: ['read', 'update'] },
  ],
  [AdminRole.INVENTORY_MANAGER]: [
    { resource: 'devices', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'handovers', actions: ['read', 'update'] },
  ],
  [AdminRole.REPORTS_VIEWER]: [
    { resource: 'reports', actions: ['read'] },
  ],
};

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
  avatar_url?: string;
  created_at: string;
  last_sign_in_at?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  requiredPermission?: { resource: string; action: PermissionAction };
  children?: NavItem[];
}
