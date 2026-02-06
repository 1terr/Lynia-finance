import { supabase } from '@/lib/supabase/client';
import type { Device, DeviceAssignment, DeviceWithRelations, DeviceLockEvent, DeviceHandover } from '@/types/database';

export interface DeviceListParams {
  search?: string;
  status?: 'available' | 'reserved' | 'assigned' | 'sold' | 'damaged' | 'returned';
  brand?: string;
  lock_enabled?: boolean;
  distributor_id?: string;
  featured?: boolean;
  page: number;
  limit: number;
}

export interface DeviceListResponse {
  devices: DeviceWithRelations[];
  total: number;
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

export interface HandoverWithRelations extends DeviceHandover {
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string;
  };
  devices?: {
    id: string;
    brand: string;
    model: string;
    imei: string | null;
  };
  distributors?: {
    id: string;
    business_name: string;
  };
}

export async function fetchDevices(
  params: DeviceListParams
): Promise<DeviceListResponse> {
  let query = supabase
    .from('devices')
    .select('*, distributors(id, business_name, contact_person, phone_number, province, city)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (params.search) {
    query = query.or(
      `brand.ilike.%${params.search}%,model.ilike.%${params.search}%,sku.ilike.%${params.search}%,imei.ilike.%${params.search}%`
    );
  }

  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.brand) {
    query = query.eq('brand', params.brand);
  }

  if (params.lock_enabled !== undefined) {
    query = query.eq('lock_enabled', params.lock_enabled);
  }

  if (params.distributor_id) {
    query = query.eq('distributor_id', params.distributor_id);
  }

  if (params.featured !== undefined) {
    query = query.eq('featured', params.featured);
  }

  const from = (params.page - 1) * params.limit;
  const to = from + params.limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    devices: (data as DeviceWithRelations[]) || [],
    total: count || 0,
  };
}

export async function fetchDeviceById(
  id: string
): Promise<DeviceWithRelations> {
  const { data, error } = await supabase
    .from('devices')
    .select(
      `*,
      distributors(id, business_name, contact_person, phone_number, province, city),
      device_assignments(*, customers:customer_id(id, first_name, last_name, phone_number))`
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as DeviceWithRelations;
}

export async function fetchDeviceInventorySummary(): Promise<DeviceInventorySummary> {
  const { data, error } = await supabase
    .from('devices')
    .select('status')
    .is('deleted_at', null);

  if (error) throw error;

  const summary: DeviceInventorySummary = {
    total_devices: 0,
    available: 0,
    reserved: 0,
    assigned: 0,
    sold: 0,
    damaged: 0,
    returned: 0,
  };

  (data || []).forEach((d: { status: string }) => {
    summary.total_devices++;
    switch (d.status) {
      case 'available': summary.available++; break;
      case 'reserved': summary.reserved++; break;
      case 'assigned': summary.assigned++; break;
      case 'sold': summary.sold++; break;
      case 'damaged': summary.damaged++; break;
      case 'returned': summary.returned++; break;
    }
  });

  return summary;
}

export async function updateDevice(
  id: string,
  updates: Partial<Device>
): Promise<Device> {
  const { data, error } = await supabase
    .from('devices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function lockDevice(
  assignmentId: string,
  reason: string
): Promise<DeviceAssignment> {
  const { data, error } = await supabase
    .from('device_assignments')
    .update({
      lock_status: 'locked',
      locked_at: new Date().toISOString(),
      locked_reason: reason,
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unlockDevice(
  assignmentId: string
): Promise<DeviceAssignment> {
  const { data, error } = await supabase
    .from('device_assignments')
    .update({
      lock_status: 'unlocked',
      unlocked_at: new Date().toISOString(),
      locked_reason: null,
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function permanentUnlockDevice(
  assignmentId: string
): Promise<DeviceAssignment> {
  const { data, error } = await supabase
    .from('device_assignments')
    .update({
      lock_status: 'permanent_unlock',
      unlocked_at: new Date().toISOString(),
      locked_reason: null,
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchDeviceLockHistory(
  deviceId: string
): Promise<DeviceLockEvent[]> {
  const { data, error } = await supabase
    .from('device_lock_events')
    .select('*')
    .eq('device_id', deviceId)
    .order('performed_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data as DeviceLockEvent[]) || [];
}

export async function fetchDeviceHandovers(
  params?: { status?: string; device_id?: string }
): Promise<HandoverWithRelations[]> {
  let query = supabase
    .from('device_handovers')
    .select(
      '*, customers(id, first_name, last_name, phone_number), devices(id, brand, model, imei), distributors(id, business_name)'
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (params?.status) {
    query = query.eq('status', params.status);
  }

  if (params?.device_id) {
    query = query.eq('device_id', params.device_id);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data as HandoverWithRelations[]) || [];
}

export async function scheduleHandover(handover: {
  loan_id: string;
  customer_id: string;
  device_id: string;
  distributor_id: string;
  scheduled_date: string;
  scheduled_time: string;
  notes?: string;
}): Promise<DeviceHandover> {
  const { data, error } = await supabase
    .from('device_handovers')
    .insert({
      ...handover,
      status: 'initiated',
      identity_verified: false,
      deposit_verified: false,
      device_inspected: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateHandoverStatus(
  handoverId: string,
  updates: Partial<DeviceHandover>
): Promise<DeviceHandover> {
  const { data, error } = await supabase
    .from('device_handovers')
    .update(updates)
    .eq('id', handoverId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeHandover(
  handoverId: string
): Promise<DeviceHandover> {
  return updateHandoverStatus(handoverId, {
    status: 'completed',
    identity_verified: true,
    deposit_verified: true,
    device_inspected: true,
    completed_at: new Date().toISOString(),
  });
}

export async function assignDistributor(
  deviceId: string,
  distributorId: string
): Promise<Device> {
  return updateDevice(deviceId, { distributor_id: distributorId });
}

export async function bulkUpdateDeviceStatus(
  deviceIds: string[],
  status: Device['status']
): Promise<void> {
  const { error } = await supabase
    .from('devices')
    .update({ status })
    .in('id', deviceIds);

  if (error) throw error;
}

export async function bulkAssignDistributor(
  deviceIds: string[],
  distributorId: string
): Promise<void> {
  const { error } = await supabase
    .from('devices')
    .update({ distributor_id: distributorId })
    .in('id', deviceIds);

  if (error) throw error;
}

export async function fetchDistributors() {
  const { data, error } = await supabase
    .from('distributors')
    .select('id, business_name, contact_person, phone_number, province, city')
    .eq('status', 'active')
    .order('business_name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function exportDevicesToCSV(devices: DeviceWithRelations[]): string {
  const headers = [
    'Device ID',
    'Brand',
    'Model',
    'SKU',
    'IMEI',
    'Status',
    'Retail Price',
    'Financing Price',
    'Deposit',
    'Lock Enabled',
    'Distributor',
    'Warehouse',
  ];

  const rows = devices.map((d) => [
    d.id,
    d.brand,
    d.model,
    d.sku,
    d.imei || '',
    d.status,
    d.retail_price.toFixed(2),
    d.financing_price.toFixed(2),
    d.deposit_amount.toFixed(2),
    d.lock_enabled ? 'Yes' : 'No',
    d.distributors?.business_name || '',
    d.warehouse_location || '',
  ]);

  return [headers, ...rows].map((row) => row.join(',')).join('\n');
}
