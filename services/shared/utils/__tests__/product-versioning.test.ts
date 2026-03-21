/**
 * Unit tests for services/shared/utils/product-versioning.ts
 *
 * Tests version creation, auto-increment, and retrieval.
 * Uses mocked database client.
 */

import { createProductVersion, getProductVersions } from '../product-versioning';

// Mock the database client
const mockQuery = jest.fn();
jest.mock('../../clients/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

// Mock logger
jest.mock('../logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('createProductVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should auto-increment version_number from 0 for first version', async () => {
    // First call: get max version (none exists)
    mockQuery.mockResolvedValueOnce({ data: [{ max_version: null }], error: null });
    // Second call: insert
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    await createProductVersion({
      productId: 'prod-123',
      changedBy: 'admin@lynia.co',
      changeType: 'create',
      previousValues: null,
      newValues: { product_name: 'Test Product', interest_rate_annual: 48 },
    });

    // Should insert with version_number = 1
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[1][1]).toBe(1); // version_number
    expect(insertCall[1][2]).toBe('admin@lynia.co');
    expect(insertCall[1][3]).toBe('create');
  });

  it('should increment version_number from existing max', async () => {
    mockQuery.mockResolvedValueOnce({ data: [{ max_version: 3 }], error: null });
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    await createProductVersion({
      productId: 'prod-123',
      changedBy: 'admin@lynia.co',
      changeType: 'update',
      previousValues: { interest_rate_annual: 48 },
      newValues: { interest_rate_annual: 36 },
    });

    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[1][1]).toBe(4); // version_number = 3 + 1
    expect(insertCall[1][3]).toBe('update');
  });

  it('should pass previous_values as null for create change type', async () => {
    mockQuery.mockResolvedValueOnce({ data: [{ max_version: null }], error: null });
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    await createProductVersion({
      productId: 'prod-123',
      changedBy: 'admin@lynia.co',
      changeType: 'create',
      previousValues: null,
      newValues: { product_name: 'New Product' },
    });

    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[1][4]).toBeNull(); // previous_values
    expect(insertCall[1][5]).toBe(JSON.stringify({ product_name: 'New Product' }));
  });

  it('should serialize previous_values as JSON for update change type', async () => {
    mockQuery.mockResolvedValueOnce({ data: [{ max_version: 1 }], error: null });
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const prevValues = { interest_rate_annual: 48, min_amount_usd: 100 };
    const newValues = { interest_rate_annual: 36, min_amount_usd: 150 };

    await createProductVersion({
      productId: 'prod-123',
      changedBy: 'admin@lynia.co',
      changeType: 'update',
      previousValues: prevValues,
      newValues: newValues,
    });

    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[1][4]).toBe(JSON.stringify(prevValues));
    expect(insertCall[1][5]).toBe(JSON.stringify(newValues));
  });

  it('should include change_reason when provided', async () => {
    mockQuery.mockResolvedValueOnce({ data: [{ max_version: 2 }], error: null });
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    await createProductVersion({
      productId: 'prod-123',
      changedBy: 'admin@lynia.co',
      changeType: 'update',
      previousValues: { status: 'active' },
      newValues: { status: 'inactive' },
      changeReason: 'Product paused for review',
    });

    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[1][6]).toBe('Product paused for review');
  });
});

describe('getProductVersions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return versions ordered by version_number DESC', async () => {
    const mockVersions = [
      { id: 'v2', product_id: 'prod-123', version_number: 2, changed_by: 'admin@lynia.co', changed_at: '2026-01-02T00:00:00Z', change_type: 'update', previous_values: {}, new_values: {}, change_reason: null, created_at: '2026-01-02T00:00:00Z' },
      { id: 'v1', product_id: 'prod-123', version_number: 1, changed_by: 'admin@lynia.co', changed_at: '2026-01-01T00:00:00Z', change_type: 'create', previous_values: null, new_values: {}, change_reason: null, created_at: '2026-01-01T00:00:00Z' },
    ];
    mockQuery.mockResolvedValueOnce({ data: mockVersions, error: null });

    const result = await getProductVersions('prod-123');

    expect(result).toHaveLength(2);
    expect(result[0].version_number).toBe(2);
    expect(result[1].version_number).toBe(1);
    expect(mockQuery.mock.calls[0][1]).toEqual(['prod-123']);
  });

  it('should return empty array on error', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: new Error('DB connection failed') });

    const result = await getProductVersions('prod-123');

    expect(result).toEqual([]);
  });

  it('should return empty array for product with no versions', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const result = await getProductVersions('prod-new');

    expect(result).toEqual([]);
  });
});
