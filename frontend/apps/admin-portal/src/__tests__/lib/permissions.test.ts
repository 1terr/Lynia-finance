import { hasPermission, hasAnyPermission, canAccessRoute } from '@/lib/permissions';
import {
  hasPermission as hasResourcePermission,
  hasAnyPermission as hasAnyResourcePermission,
  getRoleDisplayName,
} from '@/lib/auth/permissions';
import type { AdminRole } from '@/types/auth';

// ── lib/permissions.ts (route-level) ──

describe('lib/permissions — hasPermission', () => {
  it('super_admin has all permissions', () => {
    expect(hasPermission('super_admin', 'dashboard:view')).toBe(true);
    expect(hasPermission('super_admin', 'settings:write')).toBe(true);
    expect(hasPermission('super_admin', 'admin_users:write')).toBe(true);
  });

  it('reports_viewer has only dashboard + reports', () => {
    expect(hasPermission('reports_viewer', 'dashboard:view')).toBe(true);
    expect(hasPermission('reports_viewer', 'reports:read')).toBe(true);
    expect(hasPermission('reports_viewer', 'reports:export')).toBe(true);
    expect(hasPermission('reports_viewer', 'customers:read')).toBe(false);
    expect(hasPermission('reports_viewer', 'loans:approve')).toBe(false);
  });

  it('returns false for unknown role', () => {
    expect(hasPermission('nonexistent' as AdminRole, 'dashboard:view')).toBe(false);
  });
});

describe('lib/permissions — hasAnyPermission', () => {
  it('returns true when user has at least one', () => {
    expect(
      hasAnyPermission('kyc_reviewer', ['kyc:approve', 'settings:write'])
    ).toBe(true);
  });

  it('returns false when user has none', () => {
    expect(
      hasAnyPermission('reports_viewer', ['customers:write', 'loans:approve'])
    ).toBe(false);
  });

  it('returns false for empty permissions array', () => {
    expect(hasAnyPermission('super_admin', [])).toBe(false);
  });
});

describe('lib/permissions — canAccessRoute', () => {
  it('all roles can access root path', () => {
    const roles: AdminRole[] = [
      'super_admin', 'admin', 'operations_manager', 'kyc_reviewer',
      'finance_team', 'inventory_manager', 'customer_support', 'reports_viewer',
    ];
    roles.forEach((role) => {
      expect(canAccessRoute(role, '/')).toBe(true);
    });
  });

  it('grants access to /customers for roles with customers:read', () => {
    expect(canAccessRoute('super_admin', '/customers')).toBe(true);
    expect(canAccessRoute('customer_support', '/customers')).toBe(true);
  });

  it('denies /customers for roles without customers:read', () => {
    expect(canAccessRoute('reports_viewer', '/customers')).toBe(false);
    expect(canAccessRoute('inventory_manager', '/customers')).toBe(false);
  });

  it('grants /reports for roles with reports:read', () => {
    expect(canAccessRoute('reports_viewer', '/reports')).toBe(true);
    expect(canAccessRoute('finance_team', '/reports')).toBe(true);
  });

  it('denies /reports for roles without reports:read', () => {
    expect(canAccessRoute('kyc_reviewer', '/reports')).toBe(false);
  });

  it('grants /devices for roles with devices:read', () => {
    expect(canAccessRoute('inventory_manager', '/devices')).toBe(true);
    expect(canAccessRoute('super_admin', '/devices')).toBe(true);
  });

  it('denies /devices for roles without devices:read', () => {
    expect(canAccessRoute('reports_viewer', '/devices')).toBe(false);
    expect(canAccessRoute('finance_team', '/devices')).toBe(false);
  });

  it('grants access to unmapped routes (default allow)', () => {
    expect(canAccessRoute('reports_viewer', '/unknown-page')).toBe(true);
  });

  it('grants /settings only for roles with settings:read', () => {
    expect(canAccessRoute('super_admin', '/settings')).toBe(true);
    expect(canAccessRoute('admin', '/settings')).toBe(true);
    expect(canAccessRoute('reports_viewer', '/settings')).toBe(false);
  });
});

// ── lib/auth/permissions.ts (resource:action-level) ──

describe('auth/permissions — hasPermission (resource:action)', () => {
  it('checks combined resource:action against role', () => {
    expect(hasResourcePermission('super_admin', 'customers', 'read')).toBe(true);
    expect(hasResourcePermission('super_admin', 'settings', 'write')).toBe(true);
  });

  it('returns false for permission not in role', () => {
    expect(hasResourcePermission('kyc_reviewer', 'loans', 'approve')).toBe(false);
    expect(hasResourcePermission('reports_viewer', 'customers', 'write')).toBe(false);
  });

  it('returns false for unknown role', () => {
    expect(hasResourcePermission('unknown' as AdminRole, 'dashboard', 'view')).toBe(false);
  });
});

describe('auth/permissions — hasAnyResourcePermission', () => {
  it('returns true when at least one check passes', () => {
    expect(
      hasAnyResourcePermission('kyc_reviewer', [
        { resource: 'kyc', action: 'approve' },
        { resource: 'settings', action: 'write' },
      ])
    ).toBe(true);
  });

  it('returns false when no checks pass', () => {
    expect(
      hasAnyResourcePermission('reports_viewer', [
        { resource: 'customers', action: 'write' },
        { resource: 'loans', action: 'approve' },
      ])
    ).toBe(false);
  });
});

describe('auth/permissions — getRoleDisplayName', () => {
  it('returns human-readable names for all roles', () => {
    expect(getRoleDisplayName('super_admin')).toBe('Super Admin');
    expect(getRoleDisplayName('admin')).toBe('Admin');
    expect(getRoleDisplayName('operations_manager')).toBe('Operations Manager');
    expect(getRoleDisplayName('kyc_reviewer')).toBe('KYC Reviewer');
    expect(getRoleDisplayName('finance_team')).toBe('Finance Team');
    expect(getRoleDisplayName('inventory_manager')).toBe('Inventory Manager');
    expect(getRoleDisplayName('customer_support')).toBe('Customer Support');
    expect(getRoleDisplayName('reports_viewer')).toBe('Reports Viewer');
  });

  it('falls back to raw role string for unknown roles', () => {
    expect(getRoleDisplayName('unknown_role' as AdminRole)).toBe('unknown_role');
  });
});
