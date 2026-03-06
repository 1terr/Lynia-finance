import { fetchAPI } from '@lynia/api-client';
import { MAX_PAGE_SIZE } from '@lynia/utils';
import type {
  Distributor,
  CreateDistributorInput,
  DistributorStatsResponse,
  DistributorInventoryItem,
  DistributorHandover,
  DistributorTransfer,
  DistributorCommission,
} from '@/types';

// ─── Distributor Filters ───

export interface DistributorFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// ─── Distributor CRUD ───

export async function getDistributors(filters: DistributorFilters = {}) {
  const { search, status, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (search) params.set('search', search);
  if (status) params.set('status', status);

  return fetchAPI<{
    data: Distributor[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/admin/distributors?${params.toString()}`);
}

export async function getDistributorStats(): Promise<DistributorStatsResponse> {
  return fetchAPI<DistributorStatsResponse>('/admin/distributors/stats');
}

export async function getDistributor(id: string): Promise<Distributor | null> {
  try {
    return await fetchAPI<Distributor>(`/admin/distributors/${id}`);
  } catch {
    return null;
  }
}

export async function createDistributor(data: CreateDistributorInput): Promise<Distributor> {
  return fetchAPI<Distributor>('/admin/distributors', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDistributor(id: string, data: Partial<CreateDistributorInput>): Promise<Distributor> {
  return fetchAPI<Distributor>(`/admin/distributors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Distributor Inventory ───

export interface DistributorInventoryFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export async function getDistributorInventory(id: string, filters: DistributorInventoryFilters = {}) {
  const { search, status, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (search) params.set('search', search);
  if (status) params.set('status', status);

  return fetchAPI<{
    data: DistributorInventoryItem[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/admin/distributors/${id}/inventory?${params.toString()}`);
}

// ─── Distributor Handovers ───

export interface DistributorHandoverFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getDistributorHandovers(id: string, filters: DistributorHandoverFilters = {}) {
  const { status, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  if (search) params.set('search', search);

  return fetchAPI<{
    data: DistributorHandover[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/admin/distributors/${id}/handovers?${params.toString()}`);
}

// ─── Distributor Transfers ───

export interface DistributorTransferFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export async function getDistributorTransfers(id: string, filters: DistributorTransferFilters = {}) {
  const { status, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) params.set('status', status);

  return fetchAPI<{
    data: DistributorTransfer[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/admin/distributors/${id}/transfers?${params.toString()}`);
}

// ─── Distributor Commissions ───

export interface DistributorCommissionFilters {
  page?: number;
  limit?: number;
}

export async function getDistributorCommissions(id: string, filters: DistributorCommissionFilters = {}) {
  const { page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));

  return fetchAPI<{
    data: DistributorCommission[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    summary: {
      total_earned: number;
      total_paid: number;
      pending: number;
    };
  }>(`/admin/distributors/${id}/commissions?${params.toString()}`);
}

// ─── Commission Payments ───

export async function bulkPayCommissions(distributorId: string, commissionIds: string[]): Promise<{ paid: number; total: number }> {
  return fetchAPI<{ paid: number; total: number }>(`/admin/distributors/${distributorId}/commissions/pay`, {
    method: 'POST',
    body: JSON.stringify({ commission_ids: commissionIds }),
  });
}
