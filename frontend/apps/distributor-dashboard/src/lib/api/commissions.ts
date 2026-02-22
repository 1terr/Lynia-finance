import type { CommissionEntry } from '@/types/distributor';
import { fetchAPI } from '@lynia/api-client';
import { delay, useMock } from '@/test/mocks/utils';
import { mockCommissions } from '@/test/mocks/commissions';

/**
 * Fetch commission entries for the distributor
 */
export async function fetchCommissions(): Promise<CommissionEntry[]> {
  if (useMock()) {
    await delay(400);
    return [...mockCommissions];
  }
  return fetchAPI<CommissionEntry[]>('/api/v1/distributor/commissions');
}
