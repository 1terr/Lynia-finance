import type { Distributor } from '@/types/distributor';
import { fetchAPI } from '@lynia/api-client';
import { delay, useMock } from '@/test/mocks/utils';
import { mockDistributor } from '@/test/mocks/distributor';

/**
 * Fetch the current distributor's profile
 */
export async function fetchDistributorProfile(): Promise<Distributor> {
  if (useMock()) {
    await delay(400);
    return { ...mockDistributor };
  }
  return fetchAPI<Distributor>('/api/v1/distributor/profile');
}

/**
 * Update the current distributor's profile
 */
export async function updateDistributorProfile(updates: Partial<Distributor>): Promise<Distributor> {
  if (useMock()) {
    await delay(400);
    Object.assign(mockDistributor, updates);
    return { ...mockDistributor };
  }
  return fetchAPI<Distributor>('/api/v1/distributor/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}
