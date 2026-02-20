import { fetchAPI } from '@/lib/api/client';
import { MAX_PAGE_SIZE } from '@/lib/utils';
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
  const { status, lock_status, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  if (lock_status) params.set('lock_status', lock_status);
  if (search) params.set('search', search);

  return fetchAPI<{
    data: DeviceWithCustomer[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/api/v1/devices?${params.toString()}`);
}

export async function getDeviceById(id: string): Promise<Device | null> {
  try {
    return await fetchAPI<Device>(`/api/v1/devices/${id}`);
  } catch {
    return null;
  }
}

export async function getDeviceLockHistory(deviceId: string): Promise<DeviceLock[]> {
  return fetchAPI<DeviceLock[]>(`/api/v1/devices/${deviceId}/lock-history`);
}

export async function lockDevice(deviceId: string, adminId: string, reason: string) {
  return fetchAPI<void>(`/api/v1/devices/${deviceId}/lock`, {
    method: 'POST',
    body: JSON.stringify({ admin_id: adminId, reason }),
  });
}

export async function unlockDevice(deviceId: string, adminId: string, reason: string) {
  return fetchAPI<void>(`/api/v1/devices/${deviceId}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ admin_id: adminId, reason }),
  });
}

export async function updateDeviceStatus(deviceId: string, status: DeviceStatus, adminId: string) {
  return fetchAPI<void>(`/api/v1/devices/${deviceId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, admin_id: adminId }),
  });
}

export interface DeviceStats {
  in_stock: number;
  assigned: number;
  sold: number;
  locked: number;
  returned: number;
  damaged: number;
  reserved: number;
  repossessed: number;
  lost: number;
  written_off: number;
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
  status: 'initiated' | 'identity_verified' | 'deposit_verified' | 'device_inspected' | 'completed' | 'failed' | 'cancelled';
  identity_verified: boolean;
  deposit_verified: boolean;
  device_inspected: boolean;
  app_installed: boolean;
  app_configured: boolean;
  lock_test_passed: boolean;
  scheduled_date: string | null;
  scheduled_time: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  failure_reason: string | null;
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
  status: 'initiated' | 'identity_verified' | 'deposit_verified' | 'device_inspected' | 'completed' | 'failed' | 'cancelled';
  app_installed: boolean;
  app_configured: boolean;
  lock_test_passed: boolean;
  scheduled_date: string | null;
  scheduled_time: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  failure_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: { id: string; first_name: string; last_name: string; phone_number: string } | null;
  device?: { id: string; brand: string; model: string; imei: string | null } | null;
  distributor?: { id: string; business_name: string; name: string } | null;
}

export async function getDeviceHandovers(filters: { status?: string; search?: string; page?: number; limit?: number } = {}) {
  const { status, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  if (search) params.set('search', search);

  return fetchAPI<{
    data: DeviceHandoverRow[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/api/v1/devices/handovers?${params.toString()}`);
}

export async function getDeviceStats(): Promise<DeviceStats> {
  return fetchAPI<DeviceStats>('/api/v1/devices/stats');
}
