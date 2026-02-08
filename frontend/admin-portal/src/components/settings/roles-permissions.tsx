'use client';

import type { AdminRole, Permission } from '@/types/auth';
import { ROLE_PERMISSIONS } from '@/types/auth';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  operations_manager: 'Ops Manager',
  kyc_reviewer: 'KYC Reviewer',
  finance_team: 'Finance',
  inventory_manager: 'Inventory',
  customer_support: 'Support',
  reports_viewer: 'Reports',
};

const PERMISSION_GROUPS: { group: string; permissions: { key: Permission; label: string }[] }[] = [
  {
    group: 'Dashboard',
    permissions: [{ key: 'dashboard:view', label: 'View Dashboard' }],
  },
  {
    group: 'Customers',
    permissions: [
      { key: 'customers:read', label: 'View' },
      { key: 'customers:write', label: 'Edit' },
      { key: 'customers:delete', label: 'Delete' },
    ],
  },
  {
    group: 'Loans',
    permissions: [
      { key: 'loans:read', label: 'View' },
      { key: 'loans:write', label: 'Edit' },
      { key: 'loans:approve', label: 'Approve' },
      { key: 'loans:reject', label: 'Reject' },
    ],
  },
  {
    group: 'KYC',
    permissions: [
      { key: 'kyc:read', label: 'View' },
      { key: 'kyc:approve', label: 'Approve' },
      { key: 'kyc:reject', label: 'Reject' },
    ],
  },
  {
    group: 'Devices',
    permissions: [
      { key: 'devices:read', label: 'View' },
      { key: 'devices:write', label: 'Edit' },
      { key: 'devices:delete', label: 'Delete' },
      { key: 'devices:lock', label: 'Lock' },
      { key: 'devices:unlock', label: 'Unlock' },
    ],
  },
  {
    group: 'Payments',
    permissions: [
      { key: 'payments:read', label: 'View' },
      { key: 'payments:reconcile', label: 'Reconcile' },
      { key: 'payments:refund', label: 'Refund' },
    ],
  },
  {
    group: 'Reports',
    permissions: [
      { key: 'reports:read', label: 'View' },
      { key: 'reports:export', label: 'Export' },
    ],
  },
  {
    group: 'Settings',
    permissions: [
      { key: 'settings:read', label: 'View' },
      { key: 'settings:write', label: 'Edit' },
    ],
  },
  {
    group: 'Notifications',
    permissions: [{ key: 'notifications:send', label: 'Send' }],
  },
];

const ROLES: AdminRole[] = ['super_admin', 'operations_manager', 'kyc_reviewer', 'finance_team', 'inventory_manager', 'customer_support', 'reports_viewer'];

export function RolesPermissions() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Roles & Permissions</h3>
        <p className="text-sm text-muted-foreground">{ROLES.length} roles with {PERMISSION_GROUPS.reduce((sum, g) => sum + g.permissions.length, 0)} permissions</p>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {ROLES.map((role) => (
          <div key={role} className="rounded-xl border bg-card p-3 shadow-sm">
            <p className="text-xs font-semibold">{ROLE_LABELS[role]}</p>
            <p className="mt-1 text-lg font-bold">{ROLE_PERMISSIONS[role].length}</p>
            <p className="text-[10px] text-muted-foreground">permissions</p>
          </div>
        ))}
      </div>

      {/* Permission matrix */}
      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground sticky left-0 bg-muted/50 min-w-[180px]">Permission</th>
              {ROLES.map((role) => (
                <th key={role} className="px-3 py-3 text-center font-medium text-muted-foreground min-w-[90px]">
                  <span className="text-[11px]">{ROLE_LABELS[role]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <>
                <tr key={`group-${group.group}`} className="bg-muted/30">
                  <td colSpan={ROLES.length + 1} className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky left-0 bg-muted/30">
                    {group.group}
                  </td>
                </tr>
                {group.permissions.map((perm) => (
                  <tr key={perm.key} className="border-b last:border-b-0">
                    <td className="px-4 py-2.5 sticky left-0 bg-card">
                      <div>
                        <span className="font-medium">{perm.label}</span>
                        <span className="ml-1.5 text-[10px] text-muted-foreground">{perm.key}</span>
                      </div>
                    </td>
                    {ROLES.map((role) => {
                      const has = ROLE_PERMISSIONS[role].includes(perm.key);
                      return (
                        <td key={`${perm.key}-${role}`} className="px-3 py-2.5 text-center">
                          {has ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/20 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Role permissions are system-defined. Contact engineering to modify the permission matrix.
      </p>
    </div>
  );
}
