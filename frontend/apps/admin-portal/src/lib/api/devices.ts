import { fetchAPI } from '@lynia/api-client';
import { MAX_PAGE_SIZE } from '@lynia/utils';
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

// ─── Inventory Management ───

export interface CreateDeviceRequest {
  imei: string;
  serial_number?: string;
  manufacturer: string;
  model: string;
  device_type?: string;
  storage_gb?: number;
  color?: string;
  condition?: 'new' | 'grade_a' | 'grade_b' | 'grade_c';
  purchase_price_usd?: number;
  retail_price_usd?: number;
  device_model_id?: string;
  location?: string;
}

export async function createDevice(data: CreateDeviceRequest) {
  return fetchAPI<Device>('/admin/devices', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface BulkImportDevicesRequest {
  devices: CreateDeviceRequest[];
  default_location?: string;
}

export interface BulkImportResult {
  import_batch_id: string;
  total: number;
  inserted: number;
  skipped: number;
  errors: number;
  error_details: { imei: string; error: string }[];
}

export async function bulkImportDevices(data: BulkImportDevicesRequest) {
  return fetchAPI<BulkImportResult>('/admin/devices/bulk-import', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDevice(id: string, data: Partial<CreateDeviceRequest> & { status?: string }) {
  return fetchAPI<Device>(`/admin/devices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export interface InventoryMovement {
  id: string;
  device_id: string;
  movement_type: string;
  from_status: string | null;
  to_status: string | null;
  from_location: string | null;
  to_location: string | null;
  performed_by_name: string | null;
  notes: string | null;
  created_at: string;
}

export async function getDeviceMovements(deviceId: string, page = 1, limit = 50) {
  return fetchAPI<{
    data: InventoryMovement[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/admin/devices/${deviceId}/movements?page=${page}&limit=${limit}`);
}

export interface InventoryAdjustment {
  id: string;
  device_id: string;
  adjustment_type: string;
  reason: string;
  previous_status: string | null;
  new_status: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  requested_by_name: string | null;
  approved_by_name: string | null;
  device_imei: string | null;
  manufacturer: string | null;
  device_model: string | null;
  created_at: string;
}

export interface CreateAdjustmentRequest {
  device_id: string;
  device_model_id?: string;
  adjustment_type: 'add' | 'remove' | 'damage' | 'write_off' | 'found' | 'audit_correction';
  reason: string;
  new_status?: string;
  notes?: string;
}

export async function getAdjustments(filters: { approval_status?: string; adjustment_type?: string; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  params.set('page', String(filters.page || 1));
  params.set('limit', String(filters.limit || 25));
  if (filters.approval_status) params.set('approval_status', filters.approval_status);
  if (filters.adjustment_type) params.set('adjustment_type', filters.adjustment_type);

  return fetchAPI<{
    data: InventoryAdjustment[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/admin/inventory/adjustments?${params.toString()}`);
}

export async function createAdjustment(data: CreateAdjustmentRequest) {
  return fetchAPI<InventoryAdjustment>('/admin/inventory/adjustments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function approveAdjustment(id: string, action: 'approve' | 'reject', rejectionReason?: string) {
  return fetchAPI<{ message: string }>(`/admin/inventory/adjustments/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason: rejectionReason }),
  });
}

export interface StockTransfer {
  id: string;
  device_id: string;
  status: 'requested' | 'approved' | 'in_transit' | 'received' | 'cancelled';
  device_imei: string | null;
  manufacturer: string | null;
  device_model: string | null;
  from_distributor_name: string | null;
  to_distributor_name: string | null;
  from_location: string | null;
  to_location: string | null;
  requested_by_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateTransferRequest {
  device_id: string;
  from_distributor_id?: string;
  to_distributor_id?: string;
  from_location?: string;
  to_location?: string;
  notes?: string;
}

export async function getTransfers(filters: { status?: string; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  params.set('page', String(filters.page || 1));
  params.set('limit', String(filters.limit || 25));
  if (filters.status) params.set('status', filters.status);

  return fetchAPI<{
    data: StockTransfer[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/admin/inventory/transfers?${params.toString()}`);
}

export async function createTransfer(data: CreateTransferRequest) {
  return fetchAPI<StockTransfer>('/admin/inventory/transfers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTransferStatus(
  id: string,
  status: string,
  cancellationReason?: string
) {
  return fetchAPI<{ message: string }>(`/admin/inventory/transfers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, cancellation_reason: cancellationReason }),
  });
}

// ─── Inventory Reports ───

export interface InventoryReportModelRow {
  device_model_id: string;
  manufacturer: string;
  model_name: string;
  available_stock: number;
  reorder_level: number;
  total_units: number;
  in_stock: number;
  assigned: number;
  reserved: number;
  sold: number;
  damaged: number;
  returned: number;
  lost: number;
  written_off: number;
  in_stock_value: number;
  total_value: number;
}

export interface InventoryReportTotals {
  total_devices: number;
  total_in_stock: number;
  total_sold: number;
  total_damaged: number;
  total_lost: number;
  total_written_off: number;
  total_inventory_value: number;
  available_inventory_value: number;
}

export interface AgingBucket {
  age_bracket: string;
  count: number;
  value: number;
}

export interface InventoryReport {
  by_model: InventoryReportModelRow[];
  totals: InventoryReportTotals;
  aging: AgingBucket[];
  generated_at: string;
}

export async function getInventoryReport() {
  return fetchAPI<InventoryReport>('/admin/reports/inventory');
}

export interface MovementsReportEntry {
  movement_type: string;
  count: number;
  earliest: string;
  latest: string;
}

export interface MovementsReport {
  period_days: number;
  by_type: MovementsReportEntry[];
  daily: { date: string; movement_type: string; count: number }[];
  recent: (InventoryMovement & { device_imei: string; manufacturer: string; device_model: string })[];
  generated_at: string;
}

export async function getMovementsReport(days = 30) {
  return fetchAPI<MovementsReport>(`/admin/reports/inventory/movements?days=${days}`);
}

export interface LowStockModel {
  id: string;
  manufacturer: string;
  model_name: string;
  available_stock: number;
  reorder_level: number;
  lead_time_days: number | null;
  retail_price_usd: number;
  deficit: number;
  actual_in_stock: number;
  reserved: number;
  assigned_to_distributors: number;
}

export interface LowStockReport {
  low_stock_models: LowStockModel[];
  out_of_stock_models: { id: string; manufacturer: string; model_name: string; retail_price_usd: number }[];
  total_low_stock: number;
  total_out_of_stock: number;
  generated_at: string;
}

export async function getLowStockReport() {
  return fetchAPI<LowStockReport>('/admin/reports/inventory/low-stock');
}

// ─── CSV Export ───

interface CSVExportableDevice {
  id: string;
  brand?: string;
  model?: string;
  sku?: string;
  imei?: string | null;
  status?: string;
  retail_price?: number;
  financing_price?: number;
  deposit_amount?: number;
  lock_enabled?: boolean;
  distributors?: { business_name?: string } | null;
  warehouse_location?: string | null;
}

export function exportDevicesToCSV(devices: CSVExportableDevice[]): string {
  const header = 'Device ID,Brand,Model,SKU,IMEI,Status,Retail Price,Financing Price,Deposit,Lock Enabled,Distributor,Warehouse';
  const rows = devices.map((d) =>
    [
      d.id,
      d.brand ?? '',
      d.model ?? '',
      d.sku ?? '',
      d.imei ?? '',
      d.status ?? '',
      (d.retail_price ?? 0).toFixed(2),
      (d.financing_price ?? 0).toFixed(2),
      (d.deposit_amount ?? 0).toFixed(2),
      d.lock_enabled ? 'Yes' : 'No',
      d.distributors?.business_name ?? '',
      d.warehouse_location ?? '',
    ].join(',')
  );
  return [header, ...rows].join('\n');
}
