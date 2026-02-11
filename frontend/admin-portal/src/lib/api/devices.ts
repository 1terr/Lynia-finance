import { createClient } from '@/lib/supabase/client';
import { sanitizeSearchInput, MAX_PAGE_SIZE } from '@/lib/utils';
import type { Device, DeviceStatus, LockStatus, DeviceLock, Customer } from '@/types';

export interface DeviceFilters {
  status?: DeviceStatus;
  lock_status?: LockStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export type DeviceWithCustomer = Omit<Device, 'customer'> & {
  customer?: Pick<Customer, 'id' | 'full_name' | 'phone_number'> | null;
};

export async function getDevices(filters: DeviceFilters = {}) {
  const supabase = createClient();
  const { status, lock_status, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('devices')
    .select('*, customer:customers(id, full_name, phone_number)', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  if (lock_status) {
    query = query.eq('lock_status', lock_status);
  }

  if (search) {
    const sanitized = sanitizeSearchInput(search);
    if (sanitized) {
      query = query.or(`imei.ilike.%${sanitized}%,manufacturer.ilike.%${sanitized}%,model.ilike.%${sanitized}%`);
    }
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: (data || []) as DeviceWithCustomer[],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  };
}

export async function getDeviceById(id: string): Promise<Device | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('devices')
    .select('*, customer:customers(*), loan:loans(*)')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Device;
}

export async function getDeviceLockHistory(deviceId: string): Promise<DeviceLock[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('device_locks')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false });

  return (data || []) as DeviceLock[];
}

export async function lockDevice(deviceId: string, adminId: string, reason: string) {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error: deviceError } = await supabase
    .from('devices')
    .update({
      lock_status: 'locked',
      locked_at: now,
      lock_reason: reason,
      updated_at: now,
    })
    .eq('id', deviceId);

  if (deviceError) throw deviceError;

  const { error: lockError } = await supabase.from('device_locks').insert({
    device_id: deviceId,
    action: 'lock',
    reason,
    lock_type: 'manual_admin',
    executed_by: adminId,
    execution_status: 'success',
    executed_at: now,
  });

  if (lockError) throw lockError;

  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'lock',
    entity_type: 'device',
    entity_id: deviceId,
    details: { reason },
  });
}

export async function unlockDevice(deviceId: string, adminId: string, reason: string) {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error: deviceError } = await supabase
    .from('devices')
    .update({
      lock_status: 'unlocked',
      locked_at: null,
      lock_reason: null,
      updated_at: now,
    })
    .eq('id', deviceId);

  if (deviceError) throw deviceError;

  const { error: lockError } = await supabase.from('device_locks').insert({
    device_id: deviceId,
    action: 'unlock',
    reason,
    lock_type: 'manual_admin',
    executed_by: adminId,
    execution_status: 'success',
    executed_at: now,
  });

  if (lockError) throw lockError;

  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'unlock',
    entity_type: 'device',
    entity_id: deviceId,
    details: { reason },
  });
}

export async function updateDeviceStatus(deviceId: string, status: DeviceStatus, adminId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('devices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', deviceId);

  if (error) throw error;

  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'update',
    entity_type: 'device',
    entity_id: deviceId,
    details: { status },
  });
}

export interface DeviceStats {
  in_stock: number;
  allocated: number;
  active: number;
  locked: number;
  returned: number;
  damaged: number;
}

export interface DeviceInventorySummary {
  total_devices: number;
  available: number;
  reserved: number;
  assigned: number;
  sold: number;
  damaged: number;
  returned: number;
}

export interface HandoverWithRelations {
  id: string;
  loan_id: string;
  customer_id: string;
  device_id: string;
  distributor_id: string;
  status: 'initiated' | 'identity_verified' | 'deposit_verified' | 'device_inspected' | 'completed' | 'cancelled';
  identity_verified: boolean;
  deposit_verified: boolean;
  device_inspected: boolean;
  scheduled_date: string | null;
  scheduled_time: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customers?: { id: string; first_name: string; last_name: string; phone_number: string } | null;
  devices?: { id: string; brand: string; model: string; imei: string | null } | null;
  distributors?: { id: string; business_name: string } | null;
}

export interface DeviceHandoverRow {
  id: string;
  loan_id: string;
  customer_id: string;
  device_id: string;
  distributor_id: string;
  status: 'initiated' | 'identity_verified' | 'deposit_verified' | 'device_inspected' | 'completed' | 'cancelled';
  scheduled_date: string | null;
  scheduled_time: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: { id: string; first_name: string; last_name: string; phone_number: string } | null;
  device?: { id: string; brand: string; model: string; imei: string | null } | null;
  distributor?: { id: string; business_name: string; contact_person: string } | null;
}

export async function getDeviceHandovers(filters: { status?: string; search?: string; page?: number; limit?: number } = {}) {
  const supabase = createClient();
  const { status, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('device_handovers')
    .select('*, customer:customers(id, first_name, last_name, phone_number), device:devices(id, manufacturer, model, imei), distributor:distributors(id, business_name, contact_person)', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    const sanitized = sanitizeSearchInput(search);
    if (sanitized) {
      query = query.or(`customer.first_name.ilike.%${sanitized}%,customer.last_name.ilike.%${sanitized}%,device.imei.ilike.%${sanitized}%`);
    }
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: (data || []) as DeviceHandoverRow[],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  };
}

export async function getDeviceStats(): Promise<DeviceStats> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('devices')
    .select('status, lock_status');

  if (error) throw error;

  const devices = data || [];

  return {
    in_stock: devices.filter((d) => d.status === 'in_stock').length,
    allocated: devices.filter((d) => d.status === 'allocated').length,
    active: devices.filter((d) => d.status === 'active').length,
    locked: devices.filter((d) => d.lock_status === 'locked').length,
    returned: devices.filter((d) => d.status === 'returned').length,
    damaged: devices.filter((d) => d.status === 'damaged').length,
  };
}
