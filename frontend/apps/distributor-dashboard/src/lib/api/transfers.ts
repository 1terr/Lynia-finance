import type { TransferListItem, SpotCheckItem, SpotCheckInput } from '@/types/distributor';
import { fetchAPI } from '@lynia/api-client';
import { delay, shouldUseMock } from '@/test/mocks/utils';
import { mockTransfers } from '@/test/mocks/transfers';

/**
 * Fetch transfers for this distributor (incoming and outgoing).
 * Supports filtering by status, type, and pagination.
 */
export async function fetchTransfers(params?: {
  search?: string;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: TransferListItem[]; total: number; pending_count: number }> {
  if (shouldUseMock()) {
    await delay(400);
    let filtered = [...mockTransfers];
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.device_model?.toLowerCase().includes(q) ||
          t.device_manufacturer?.toLowerCase().includes(q) ||
          t.device_imei?.includes(q) ||
          t.from_distributor_name?.toLowerCase().includes(q) ||
          t.to_distributor_name?.toLowerCase().includes(q),
      );
    }
    if (params?.status) {
      filtered = filtered.filter(t => t.status === params.status);
    }
    if (params?.type) {
      filtered = filtered.filter(t => t.transfer_type === params.type);
    }
    const pendingCount = mockTransfers.filter(t => t.status === 'pending_receipt').length;
    const total = filtered.length;
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const start = (page - 1) * limit;
    filtered = filtered.slice(start, start + limit);
    return { data: filtered, total, pending_count: pendingCount };
  }

  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return fetchAPI<{ data: TransferListItem[]; total: number; pending_count: number }>(
    `/api/v1/distributor/transfers${qs ? `?${qs}` : ''}`
  );
}

/**
 * Fetch a single transfer with full details and spot-check items.
 */
export async function fetchTransferById(id: string): Promise<{
  transfer: TransferListItem;
  spot_checks?: SpotCheckItem[];
}> {
  if (shouldUseMock()) {
    await delay(300);
    const transfer = mockTransfers.find(t => t.id === id);
    if (!transfer) throw new Error('Transfer not found');
    return { transfer, spot_checks: [] };
  }
  return fetchAPI<{ transfer: TransferListItem; spot_checks?: SpotCheckItem[] }>(
    `/api/v1/distributor/transfers/${id}`
  );
}

/**
 * Confirm receipt of a transfer. Optionally submit spot-check results.
 */
export async function confirmTransfer(
  id: string,
  spotChecks?: SpotCheckInput[]
): Promise<void> {
  if (shouldUseMock()) {
    await delay(800);
    return;
  }
  await fetchAPI(`/api/v1/distributor/transfers/${id}/confirm`, {
    method: 'POST',
    body: JSON.stringify(spotChecks ? { spot_checks: spotChecks } : {}),
  });
}

/**
 * Reject/dispute an incoming transfer.
 */
export async function rejectTransfer(id: string, reason: string): Promise<void> {
  if (shouldUseMock()) {
    await delay(600);
    return;
  }
  await fetchAPI(`/api/v1/distributor/transfers/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Request to return a device to the warehouse.
 */
export async function requestReturn(deviceId: string, reason: string): Promise<void> {
  if (shouldUseMock()) {
    await delay(600);
    return;
  }
  await fetchAPI('/api/v1/distributor/transfers/return', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, reason }),
  });
}

/**
 * Fetch count of transfers needing distributor action.
 */
export async function fetchPendingTransferCount(): Promise<number> {
  if (shouldUseMock()) {
    await delay(200);
    return mockTransfers.filter(t => t.status === 'pending_receipt').length;
  }
  const result = await fetchAPI<{ pending_count: number }>(
    '/api/v1/distributor/transfers/pending-count'
  );
  return result.pending_count;
}
