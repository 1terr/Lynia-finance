import { ROLE_PERMISSIONS } from '@/types/auth';
import type { AdminRole, Permission } from '@/types/auth';

describe('ROLE_PERMISSIONS', () => {
  const allRoles: AdminRole[] = [
    'super_admin', 'admin', 'operations_manager', 'kyc_reviewer',
    'finance_team', 'inventory_manager', 'customer_support', 'reports_viewer',
  ];

  it('defines permissions for all 8 roles', () => {
    expect(Object.keys(ROLE_PERMISSIONS)).toHaveLength(8);
    allRoles.forEach((role) => {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
    });
  });

  it('super_admin has all 24 permissions', () => {
    expect(ROLE_PERMISSIONS.super_admin).toHaveLength(24);
  });

  it('all roles have dashboard:view', () => {
    allRoles.forEach((role) => {
      expect(ROLE_PERMISSIONS[role]).toContain('dashboard:view');
    });
  });

  it('only super_admin has settings:write', () => {
    const rolesWithSettingsWrite = allRoles.filter((r) =>
      ROLE_PERMISSIONS[r].includes('settings:write')
    );
    expect(rolesWithSettingsWrite).toEqual(['super_admin']);
  });

  it('kyc_reviewer can approve and reject KYC', () => {
    expect(ROLE_PERMISSIONS.kyc_reviewer).toContain('kyc:approve');
    expect(ROLE_PERMISSIONS.kyc_reviewer).toContain('kyc:reject');
  });

  it('finance_team can reconcile and refund payments', () => {
    expect(ROLE_PERMISSIONS.finance_team).toContain('payments:reconcile');
    expect(ROLE_PERMISSIONS.finance_team).toContain('payments:refund');
  });

  it('inventory_manager can manage devices', () => {
    expect(ROLE_PERMISSIONS.inventory_manager).toContain('devices:read');
    expect(ROLE_PERMISSIONS.inventory_manager).toContain('devices:write');
    expect(ROLE_PERMISSIONS.inventory_manager).toContain('devices:delete');
  });

  it('customer_support has read-only + notification access', () => {
    expect(ROLE_PERMISSIONS.customer_support).toContain('customers:read');
    expect(ROLE_PERMISSIONS.customer_support).toContain('notifications:send');
    expect(ROLE_PERMISSIONS.customer_support).not.toContain('customers:write');
    expect(ROLE_PERMISSIONS.customer_support).not.toContain('loans:approve');
  });

  it('reports_viewer can only view and export reports', () => {
    expect(ROLE_PERMISSIONS.reports_viewer).toContain('reports:read');
    expect(ROLE_PERMISSIONS.reports_viewer).toContain('reports:export');
    expect(ROLE_PERMISSIONS.reports_viewer).toHaveLength(3); // dashboard:view + reports:read + reports:export
  });

  it('admin has nearly all permissions except settings:write', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('dashboard:view');
    expect(ROLE_PERMISSIONS.admin).toContain('customers:read');
    expect(ROLE_PERMISSIONS.admin).toContain('loans:approve');
    expect(ROLE_PERMISSIONS.admin).toContain('settings:read');
    expect(ROLE_PERMISSIONS.admin).not.toContain('settings:write');
  });

  it('no role has duplicate permissions', () => {
    allRoles.forEach((role) => {
      const perms = ROLE_PERMISSIONS[role];
      const unique = new Set(perms);
      expect(unique.size).toBe(perms.length);
    });
  });
});
