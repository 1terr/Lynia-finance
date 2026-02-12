import { fetchAPI } from '@/lib/api/client';
import { MAX_PAGE_SIZE } from '@/lib/utils';
import type { AdminUser, AdminRole, SystemConfig, AuditLog } from '@/types';

// --- Admin Users ---

export interface AdminUserFilters {
  role?: AdminRole;
  status?: 'active' | 'inactive';
  search?: string;
  page?: number;
  limit?: number;
}

export async function getAdminUsers(filters: AdminUserFilters = {}) {
  const { role, status, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  if (search) params.set('search', search);

  return fetchAPI<{
    data: AdminUser[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/api/v1/admin/users?${params.toString()}`);
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  try {
    return await fetchAPI<AdminUser>(`/api/v1/admin/users/${id}`);
  } catch {
    return null;
  }
}

export interface CreateAdminUserData {
  email: string;
  first_name: string;
  last_name: string;
  role: AdminRole;
}

export async function createAdminUser(userData: CreateAdminUserData): Promise<AdminUser> {
  return fetchAPI<AdminUser>('/api/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export interface UpdateAdminUserData {
  role?: AdminRole;
  is_active?: boolean;
  first_name?: string;
  last_name?: string;
}

export async function updateAdminUser(
  id: string,
  updates: UpdateAdminUserData,
  adminId?: string
): Promise<AdminUser> {
  return fetchAPI<AdminUser>(`/api/v1/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...updates, admin_id: adminId }),
  });
}

// --- System Config ---

export async function getSystemConfigs(): Promise<SystemConfig[]> {
  return fetchAPI<SystemConfig[]>('/api/v1/admin/config');
}

export async function updateSystemConfig(
  id: string,
  configValue: Record<string, unknown>,
  adminId: string
): Promise<SystemConfig> {
  return fetchAPI<SystemConfig>(`/api/v1/admin/config/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ config_value: configValue, admin_id: adminId }),
  });
}

// --- Audit Logs ---

export interface AuditLogFilters {
  user_type?: 'admin' | 'customer' | 'system';
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export async function getAuditLogs(filters: AuditLogFilters = {}) {
  const { user_type, action, entity_type, date_from, date_to, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (user_type) params.set('user_type', user_type);
  if (action) params.set('action', action);
  if (entity_type) params.set('entity_type', entity_type);
  if (date_from) params.set('date_from', date_from);
  if (date_to) params.set('date_to', date_to);

  return fetchAPI<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/api/v1/admin/audit-logs?${params.toString()}`);
}
