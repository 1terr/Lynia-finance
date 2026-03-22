import type { CommissionEntry } from '@/types/distributor';
import { fetchAPI } from '@lynia/api-client';
import { delay, shouldUseMock } from '@/test/mocks/utils';
import { mockCommissions } from '@/test/mocks/commissions';

export interface FetchCommissionsParams {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface FetchCommissionsResult {
  data: CommissionEntry[];
  total: number;
}

/**
 * Fetch commission entries for the distributor with server-side filtering and pagination.
 */
export async function fetchCommissions(params?: FetchCommissionsParams): Promise<FetchCommissionsResult> {
  if (shouldUseMock()) {
    await delay(400);
    let filtered = [...mockCommissions];

    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          c.device_model.toLowerCase().includes(q) ||
          c.loan_id.toLowerCase().includes(q),
      );
    }
    if (params?.status && params.status !== 'all') {
      filtered = filtered.filter((c) => c.payment_status === params.status);
    }
    if (params?.date_from) {
      filtered = filtered.filter((c) => c.calculation_date >= params.date_from!);
    }
    if (params?.date_to) {
      filtered = filtered.filter((c) => c.calculation_date <= params.date_to!);
    }

    const total = filtered.length;
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const start = (page - 1) * limit;
    filtered = filtered.slice(start, start + limit);

    return { data: filtered, total };
  }

  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params?.date_from) searchParams.set('date_from', params.date_from);
  if (params?.date_to) searchParams.set('date_to', params.date_to);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return fetchAPI<FetchCommissionsResult>(
    `/api/v1/distributor/commissions${qs ? `?${qs}` : ''}`,
  );
}
