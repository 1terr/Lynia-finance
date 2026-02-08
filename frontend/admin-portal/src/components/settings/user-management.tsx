'use client';

import { useEffect, useState } from 'react';
import type { AdminRole } from '@/types/auth';
import type { AdminUserWithMeta, CreateAdminUserPayload } from '@/types/settings';
import { fetchAdminUsers, createAdminUser, updateAdminUser } from '@/lib/api/settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, UserCog, Shield, X } from 'lucide-react';

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  operations_manager: 'Operations Manager',
  kyc_reviewer: 'KYC Reviewer',
  finance_team: 'Finance Team',
  inventory_manager: 'Inventory Manager',
  customer_support: 'Customer Support',
  reports_viewer: 'Reports Viewer',
};

const ROLE_COLORS: Record<AdminRole, 'default' | 'destructive' | 'secondary' | 'outline' | 'success' | 'warning' | 'info'> = {
  super_admin: 'destructive',
  operations_manager: 'default',
  kyc_reviewer: 'info',
  finance_team: 'success',
  inventory_manager: 'warning',
  customer_support: 'secondary',
  reports_viewer: 'outline',
};

const DEPARTMENTS = ['Executive', 'Operations', 'Compliance', 'Finance', 'Logistics', 'Support', 'Engineering'];

export function UserManagement() {
  const [users, setUsers] = useState<AdminUserWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserWithMeta | null>(null);
  const [form, setForm] = useState<CreateAdminUserPayload>({
    email: '', first_name: '', last_name: '', role: 'customer_support', department: null, phone: null,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminUsers().then((u) => { setUsers(u); setLoading(false); });
  }, []);

  const openCreate = () => {
    setEditingUser(null);
    setForm({ email: '', first_name: '', last_name: '', role: 'customer_support', department: null, phone: null });
    setShowModal(true);
  };

  const openEdit = (user: AdminUserWithMeta) => {
    setEditingUser(user);
    setForm({ email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role, department: user.department, phone: user.phone });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editingUser) {
      const updated = await updateAdminUser(editingUser.id, {
        first_name: form.first_name, last_name: form.last_name, role: form.role, department: form.department, phone: form.phone,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } else {
      const created = await createAdminUser(form);
      setUsers((prev) => [...prev, created]);
    }
    setSaving(false);
    setShowModal(false);
  };

  const handleToggleActive = async (user: AdminUserWithMeta) => {
    const updated = await updateAdminUser(user.id, { is_active: !user.is_active });
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Admin Users</h3>
          <p className="text-sm text-muted-foreground">{users.length} users total, {users.filter((u) => u.is_active).length} active</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Add User</Button>
      </div>

      {/* Users table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Department</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">MFA</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last Login</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className={cn('border-b last:border-b-0', !user.is_active && 'opacity-50')}>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge variant={ROLE_COLORS[user.role]}>{ROLE_LABELS[user.role]}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{user.department ?? '-'}</td>
                <td className="px-4 py-3">
                  <Shield className={cn('h-4 w-4', user.mfa_enabled ? 'text-green-600' : 'text-muted-foreground/30')} />
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.is_active ? 'success' : 'secondary'}>{user.is_active ? 'Active' : 'Inactive'}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                      <UserCog className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(user)}
                      className={user.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              {!editingUser && (
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="user@lynia.co.zw"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <select
                  value={form.department ?? ''}
                  onChange={(e) => setForm({ ...form, department: e.target.value || null })}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select department...</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  value={form.phone ?? ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value || null })}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="+263..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || (!editingUser && !form.email)}>
                {saving ? 'Saving...' : editingUser ? 'Update' : 'Create User'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
