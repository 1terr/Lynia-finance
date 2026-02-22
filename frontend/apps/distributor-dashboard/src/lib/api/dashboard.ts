import type { DashboardStats } from '@/types/distributor';
import { fetchAPI } from '@lynia/api-client';
import { delay, useMock } from '@/test/mocks/utils';
import { mockDashboardStats } from '@/test/mocks/stats';

/**
 * Fetch dashboard statistics for the current distributor
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  if (useMock()) {
    await delay(400);
    return { ...mockDashboardStats };
  }
  return fetchAPI<DashboardStats>('/api/v1/distributor/stats');
}
