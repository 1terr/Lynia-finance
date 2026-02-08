'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  getSystemConfigs,
  updateSystemConfig,
  getAuditLogs,
  type AdminUserFilters,
  type AuditLogFilters,
  type CreateAdminUserData,
} from '@/lib/api/settings';
import { useAuth } from '@/lib/hooks/use-auth';
import { hasPermission } from '@/lib/permissions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { formatDateTime } from '@/lib/utils';
import type { AdminUser, AdminRole, SystemConfig, AuditLog } from '@/types';
import { Users, Settings, Shield, History } from 'lucide-react';

// --- Role-Permission mapping for display ---

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  operations_manager: 'Operations Manager',
  customer_support: 'Customer Support',
  finance_team: 'Finance Team',
  kyc_reviewer: 'KYC Reviewer',
  inventory_manager: 'Inventory Manager',
  reports_viewer: 'Reports Viewer',
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const PERMISSION_CATEGORIES = [
  { key: 'customers', label: 'Customers' },
  { key: 'loans', label: 'Loans' },
  { key: 'payments', label: 'Payments' },
  { key: 'devices', label: 'Devices' },
  { key: 'kyc', label: 'KYC' },
  { key: 'reports', label: 'Reports' },
  { key: 'admin_users', label: 'Admin Users' },
  { key: 'settings', label: 'Settings' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
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

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'login', label: 'Login' },
];

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All Entities' },
  { value: 'customer', label: 'Customer' },
  { value: 'loan', label: 'Loan' },
  { value: 'payment', label: 'Payment' },
  { value: 'device', label: 'Device' },
  { value: 'kyc_submission', label: 'KYC Submission' },
  { value: 'admin_user', label: 'Admin User' },
  { value: 'system_config', label: 'System Config' },
];

// ============================================================
// Main Settings Page
// ============================================================

export default function SettingsPage() {
  const { user } = useAuth();
  const canWriteUsers = user ? hasPermission(user.role, 'admin_users:write') : false;
  const canWriteSettings = user ? hasPermission(user.role, 'settings:write') : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">
          System configuration, user management, and audit logs.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Users
            </span>
          </TabsTrigger>
          <TabsTrigger value="config">
            <span className="flex items-center gap-1.5">
              <Settings className="h-4 w-4" />
              System Config
            </span>
          </TabsTrigger>
          <TabsTrigger value="audit">
            <span className="flex items-center gap-1.5">
              <History className="h-4 w-4" />
              Audit Log
            </span>
          </TabsTrigger>
          <TabsTrigger value="roles">
            <span className="flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              Roles
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersTab canWrite={canWriteUsers} currentUserId={user?.id} />
        </TabsContent>
        <TabsContent value="config">
          <SystemConfigTab canWrite={canWriteSettings} adminId={user?.id} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogTab />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Users Tab
// ============================================================

function UsersTab({ canWrite, currentUserId }: { canWrite: boolean; currentUserId?: string }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AdminUserFilters>({ page: 1, limit: 25 });
  const [searchInput, setSearchInput] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () => getAdminUsers(filters),
  });

  const createMutation = useMutation({
    mutationFn: (userData: CreateAdminUserData) => createAdminUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowAddModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { role?: AdminRole; is_active?: boolean } }) =>
      updateAdminUser(id, updates, currentUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput || undefined, page: 1 }));
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'full_name',
      header: 'Name',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.first_name} {row.last_name}</p>
          <p className="text-xs text-gray-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Badge variant="default" className="text-xs">
          {ROLE_LABELS[row.role] || row.role}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <Badge variant="status" status={row.is_active ? 'active' : 'inactive'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'last_login_at',
      header: 'Last Login',
      render: (row) => (
        <span className="text-sm text-gray-500">
          {row.last_login_at ? formatDateTime(row.last_login_at) : 'Never'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (row) => <span className="text-sm text-gray-500">{formatDateTime(row.created_at)}</span>,
    },
  ];

  if (canWrite) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setEditingUser(row);
          }}
        >
          Edit
        </Button>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="relative flex-1">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            className="block w-full rounded-md border border-gray-300 py-2 pl-3 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </form>
        <div className="flex gap-2">
          <Select
            options={[{ value: '', label: 'All Roles' }, ...ROLE_OPTIONS]}
            value={filters.role || ''}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                role: (e.target.value || undefined) as AdminRole | undefined,
                page: 1,
              }))
            }
            className="w-44"
          />
          {canWrite && (
            <Button onClick={() => setShowAddModal(true)} size="sm">
              Add User
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyMessage="No admin users found"
      />

      {data && data.total_pages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.total_pages}
          total={data.total}
          pageSize={data.limit}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
        />
      )}

      {/* Add User Modal */}
      <AddUserModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={(userData) => createMutation.mutate(userData)}
        isLoading={createMutation.isPending}
      />

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSubmit={(updates) =>
            updateMutation.mutate({ id: editingUser.id, updates })
          }
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  );
}

// ============================================================
// Add User Modal
// ============================================================

function AddUserModal({
  open,
  onClose,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAdminUserData) => void;
  isLoading: boolean;
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<AdminRole>('customer_support');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ email, first_name: firstName, last_name: lastName, role });
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Admin User" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create User'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Edit User Modal
// ============================================================

function EditUserModal({
  user,
  open,
  onClose,
  onSubmit,
  isLoading,
}: {
  user: AdminUser;
  open: boolean;
  onClose: () => void;
  onSubmit: (updates: { role?: AdminRole; is_active?: boolean }) => void;
  isLoading: boolean;
}) {
  const [role, setRole] = useState<AdminRole>(user.role);
  const [isActive, setIsActive] = useState(user.is_active);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updates: { role?: AdminRole; is_active?: boolean } = {};
    if (role !== user.role) updates.role = role;
    if (isActive !== user.is_active) updates.is_active = isActive;
    onSubmit(updates);
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Admin User" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
        <div>
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                checked={isActive}
                onChange={() => setIsActive(true)}
                className="h-4 w-4 text-brand-600 focus:ring-brand-500"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                checked={!isActive}
                onChange={() => setIsActive(false)}
                className="h-4 w-4 text-brand-600 focus:ring-brand-500"
              />
              Inactive
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// System Config Tab
// ============================================================

function SystemConfigTab({ canWrite, adminId }: { canWrite: boolean; adminId?: string }) {
  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ['system-configs'],
    queryFn: () => getSystemConfigs(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: Record<string, unknown> }) =>
      updateSystemConfig(id, value, adminId || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {configs && configs.length > 0 ? (
        configs.map((config) => (
          <ConfigCard
            key={config.id}
            config={config}
            canWrite={canWrite}
            onSave={(value) => updateMutation.mutate({ id: config.id, value })}
            isSaving={updateMutation.isPending}
          />
        ))
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-gray-500">No system configurations found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConfigCard({
  config,
  canWrite,
  onSave,
  isSaving,
}: {
  config: SystemConfig;
  canWrite: boolean;
  onSave: (value: Record<string, unknown>) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [jsonValue, setJsonValue] = useState(JSON.stringify(config.config_value, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  function handleSave() {
    try {
      const parsed = JSON.parse(jsonValue);
      setParseError(null);
      onSave(parsed);
      setEditing(false);
    } catch {
      setParseError('Invalid JSON. Please check the syntax.');
    }
  }

  function handleCancel() {
    setJsonValue(JSON.stringify(config.config_value, null, 2));
    setParseError(null);
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{config.config_key}</CardTitle>
            {config.description && (
              <p className="mt-1 text-xs text-gray-500">{config.description}</p>
            )}
          </div>
          {config.updated_at && (
            <span className="text-xs text-gray-400">
              Updated {formatDateTime(config.updated_at)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={jsonValue}
              onChange={(e) => {
                setJsonValue(e.target.value);
                setParseError(null);
              }}
              rows={8}
              className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {parseError && (
              <p className="text-xs text-red-600">{parseError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <pre className="overflow-x-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700">
              {JSON.stringify(config.config_value, null, 2)}
            </pre>
            {canWrite && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit Configuration
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Audit Log Tab
// ============================================================

function AuditLogTab() {
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, limit: 25 });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => getAuditLogs(filters),
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'created_at',
      header: 'Time',
      render: (row) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: 'user_email',
      header: 'User',
      render: (row) => (
        <div>
          <p className="text-sm text-gray-900">{row.user_email || 'System'}</p>
          <p className="text-xs text-gray-500">{row.user_type}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Badge variant="default" className="text-xs capitalize">
          {row.action}
        </Badge>
      ),
    },
    {
      key: 'entity_type',
      header: 'Entity',
      render: (row) => (
        <div>
          <p className="text-sm text-gray-900 capitalize">{row.entity_type.replace('_', ' ')}</p>
          {row.entity_id && (
            <p className="font-mono text-xs text-gray-500">{row.entity_id.slice(0, 8)}...</p>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-sm text-gray-600">{row.description || '-'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={ACTION_OPTIONS}
          value={filters.action || ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, action: e.target.value || undefined, page: 1 }))
          }
          className="w-full sm:w-40"
        />
        <Select
          options={ENTITY_TYPE_OPTIONS}
          value={filters.entity_type || ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, entity_type: e.target.value || undefined, page: 1 }))
          }
          className="w-full sm:w-44"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={filters.date_from || ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, date_from: e.target.value || undefined, page: 1 }))
            }
            className="block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="From"
          />
          <input
            type="date"
            value={filters.date_to || ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, date_to: e.target.value || undefined, page: 1 }))
            }
            className="block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="To"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyMessage="No audit log entries found"
      />

      {data && data.total_pages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.total_pages}
          total={data.total}
          pageSize={data.limit}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
        />
      )}
    </div>
  );
}

// ============================================================
// Roles Tab
// ============================================================

function RolesTab() {
  const roles = Object.keys(ROLE_PERMISSIONS) as AdminRole[];

  function roleHasCategory(role: string, category: string): string[] {
    const perms = ROLE_PERMISSIONS[role] || [];
    return perms.filter((p) => p.startsWith(category + ':'));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Role-based permission mapping. This is a read-only view of the access control matrix.
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Role
              </th>
              {PERMISSION_CATEGORIES.map((cat) => (
                <th
                  key={cat.key}
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {cat.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {roles.map((role) => (
              <tr key={role} className="hover:bg-gray-50">
                <td className="sticky left-0 bg-white px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                  {ROLE_LABELS[role]}
                </td>
                {PERMISSION_CATEGORIES.map((cat) => {
                  const perms = roleHasCategory(role, cat.key);
                  const hasRead = perms.some((p) => p.includes(':read'));
                  const hasWrite = perms.some(
                    (p) => p.includes(':write') || p.includes(':approve') || p.includes(':review') || p.includes(':reconcile') || p.includes(':lock') || p.includes(':export')
                  );

                  return (
                    <td key={cat.key} className="px-4 py-3 text-center">
                      {perms.length === 0 ? (
                        <span className="text-gray-300">--</span>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          {hasRead && (
                            <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                              R
                            </span>
                          )}
                          {hasWrite && (
                            <span className="inline-block rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                              W
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">R</span>
          Read access
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">W</span>
          Write / Action access
        </span>
        <span className="flex items-center gap-1">
          <span className="text-gray-300">--</span>
          No access
        </span>
      </div>
    </div>
  );
}
