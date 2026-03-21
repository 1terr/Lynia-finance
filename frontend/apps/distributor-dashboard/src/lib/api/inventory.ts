import type { InventoryDevice } from '@/types/distributor';
import { fetchAPI } from '@lynia/api-client';
import { delay, shouldUseMock } from '@/test/mocks/utils';
import { mockInventory } from '@/test/mocks/inventory';

/**
 * Fetch current inventory devices for the distributor
 */
export async function fetchInventory(): Promise<InventoryDevice[]> {
  if (shouldUseMock()) {
    await delay(400);
    return [...mockInventory];
  }
  return fetchAPI<InventoryDevice[]>('/api/v1/distributor/inventory');
}
