import { createClient } from '@/lib/supabase/client';
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
  const supabase = createClient();
  const { role, status, search, page = 1, limit = 25 } = filters;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('admin_users')
    .select('*', { count: 'exact' });

  if (role) {
    query = query.eq('role', role);
  }

  if (status === 'active') {
    query = query.eq('is_active', true);
  } else if (status === 'inactive') {
    query = query.eq('is_active', false);
  }

  if (search) {
    query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: (data || []) as AdminUser[],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  };
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as AdminUser;
}

export interface CreateAdminUserData {
  email: string;
  first_name: string;
  last_name: string;
  role: AdminRole;
}

export async function createAdminUser(userData: CreateAdminUserData): Promise<AdminUser> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('admin_users')
    .insert({
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role: userData.role,
      is_active: true,
      login_count: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as AdminUser;
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
  const supabase = createClient();

  const { data, error } = await supabase
    .from('admin_users')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Log audit entry
  if (adminId) {
    await supabase.from('audit_log').insert({
      user_id: adminId,
      user_type: 'admin',
      action: 'update',
      entity_type: 'admin_user',
      entity_id: id,
      description: `Updated admin user: ${Object.keys(updates).join(', ')}`,
      changes: updates as Record<string, unknown>,
    });
  }

  return data as AdminUser;
}

// --- System Config ---

export async function getSystemConfigs(): Promise<SystemConfig[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .order('config_key', { ascending: true });

  if (error) throw error;
  return (data || []) as SystemConfig[];
}

export async function updateSystemConfig(
  id: string,
  configValue: Record<string, unknown>,
  adminId: string
): Promise<SystemConfig> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('system_config')
    .update({
      config_value: configValue,
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Log audit entry
  await supabase.from('audit_log').insert({
    user_id: adminId,
    user_type: 'admin',
    action: 'update',
    entity_type: 'system_config',
    entity_id: id,
    description: `Updated system configuration`,
    changes: { config_value: configValue },
  });

  return data as SystemConfig;
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
  const supabase = createClient();
  const { user_type, action, entity_type, date_from, date_to, page = 1, limit = 25 } = filters;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' });

  if (user_type) {
    query = query.eq('user_type', user_type);
  }

  if (action) {
    query = query.eq('action', action);
  }

  if (entity_type) {
    query = query.eq('entity_type', entity_type);
  }

  if (date_from) {
    query = query.gte('created_at', date_from);
  }

  if (date_to) {
    query = query.lte('created_at', date_to);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: (data || []) as AuditLog[],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  };
}
