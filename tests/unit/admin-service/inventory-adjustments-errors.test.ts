/**
 * Tests for inventory-adjustments.ts error handling.
 *
 * Verifies that all 5 `.execute()` calls properly check the error return
 * and respond with 500 + logger.error when the database fails.
 */

import { createAPIGatewayEvent } from '../../helpers/test-utils';

// ── Mocks (must be declared before handler import) ────────────────────

const mockDb = { from: jest.fn() };
const mockQuery = jest.fn();
const mockQueryOne = jest.fn();

jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: mockQuery,
  queryOne: mockQueryOne,
  withTransaction: jest.fn().mockImplementation((fn: (...args: any[]) => any) => fn(jest.fn().mockResolvedValue({ data: [], error: null }))),
}));

const mockGetAuthContext = jest.fn();
const mockIsAdminOrManager = jest.fn();
jest.mock('../../../services/shared/middleware/authorization', () => ({
  getAuthContext: mockGetAuthContext,
  isAdminOrManager: mockIsAdminOrManager,
}));

const mockGetFineractClient = jest.fn();
jest.mock('../../../services/shared/clients/fineract', () => ({
  getFineractClient: mockGetFineractClient,
}));

jest.mock('../../../services/shared/utils/response', () => {
  const actual = jest.requireActual('../../../services/shared/utils/response');
  return {
    ...actual,
    getSecurityHeaders: jest.fn().mockReturnValue({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }),
  };
});

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
  setRequestContext: jest.fn().mockReturnValue('test-req-id'),
  clearRequestContext: jest.fn(),
  getRequestContext: jest.fn().mockReturnValue({ requestId: 'test-req-id' }),
  maskImei: jest.fn((imei: string) => imei),
}));

import { handler } from '../../../services/admin-service/src/index';

// ── DB mock chain ──────────────────────────────────────────────────────

const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ data: null, error: null }),
  in: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
};

function resetChain() {
  for (const key of Object.keys(mockChain) as Array<keyof typeof mockChain>) {
    if (key === 'execute') {
      mockChain.execute.mockResolvedValue({ data: null, error: null });
    } else {
      (mockChain[key] as jest.Mock).mockReturnThis();
    }
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuthContext.mockReturnValue({
    userId: 'admin-user-1',
    email: 'admin@test.com',
    roles: ['admin'],
  });
  mockIsAdminOrManager.mockReturnValue(true);
  resetChain();
  mockDb.from.mockReturnValue(mockChain);
});

// =====================================================================
// Location 1: handleCreateAdjustment — device lookup error
// =====================================================================

describe('POST /admin/inventory/adjustments — device lookup DB error', () => {
  it('should return 500 when device lookup fails with a DB error', async () => {
    // The first .execute() is the device lookup — return an error
    mockChain.execute.mockResolvedValueOnce({
      data: null,
      error: { message: 'Connection refused' },
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments',
      body: JSON.stringify({
        device_id: 'de00000000000001',
        adjustment_type: 'damage',
        reason: 'Screen cracked',
      }),
    });

    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toContain('Failed to look up device');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error looking up device',
      expect.objectContaining({
        action: 'inventory.adjustments.create',
        status: 'failed',
        errorMessage: 'Connection refused',
      }),
    );
  });
});

// =====================================================================
// Location 2: handleApproveAdjustment — adjustment fetch error
// =====================================================================

describe('POST /admin/inventory/adjustments/:id/approve — adjustment fetch DB error', () => {
  it('should return 500 when fetching adjustment fails with a DB error', async () => {
    // The first .execute() is the adjustment lookup — return an error
    mockChain.execute.mockResolvedValueOnce({
      data: null,
      error: { message: 'Timeout exceeded' },
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/adj-001/approve',
      body: JSON.stringify({ action: 'approve' }),
    });

    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toContain('Failed to fetch adjustment');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error fetching adjustment',
      expect.objectContaining({
        action: 'inventory.adjustments.approve',
        status: 'failed',
        errorMessage: 'Timeout exceeded',
      }),
    );
  });
});

// =====================================================================
// Location 3: handleApproveAdjustment — device status update error
// =====================================================================

describe('POST /admin/inventory/adjustments/:id/approve — device update DB error', () => {
  it('should return 500 when updating device status fails', async () => {
    // 1st execute: adjustment lookup — success (has new_status so device update runs)
    mockChain.execute.mockResolvedValueOnce({
      data: {
        id: 'adj-001',
        device_id: 'de00000000000001',
        new_status: 'damaged',
        approval_status: 'pending',
      },
      error: null,
    });
    // 2nd execute: device update — error
    mockChain.execute.mockResolvedValueOnce({
      data: null,
      error: { message: 'Deadlock detected' },
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/adj-001/approve',
      body: JSON.stringify({ action: 'approve' }),
    });

    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toContain('Failed to update device status');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to update device status',
      expect.objectContaining({
        action: 'inventory.adjustment.approve',
        status: 'failed',
        errorMessage: 'Deadlock detected',
      }),
    );
  });
});

// =====================================================================
// Location 4: handleApproveAdjustment — approval update error
// =====================================================================

describe('POST /admin/inventory/adjustments/:id/approve — approval update DB error', () => {
  it('should return 500 when approving adjustment fails', async () => {
    // 1st execute: adjustment lookup — success (has new_status)
    mockChain.execute.mockResolvedValueOnce({
      data: {
        id: 'adj-002',
        device_id: 'de00000000000002',
        new_status: 'damaged',
        approval_status: 'pending',
      },
      error: null,
    });
    // 2nd execute: device update — success
    mockChain.execute.mockResolvedValueOnce({ data: [], error: null });
    // 3rd execute: adjustment approval update — error
    mockChain.execute.mockResolvedValueOnce({
      data: null,
      error: { message: 'Constraint violation' },
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/adj-002/approve',
      body: JSON.stringify({ action: 'approve' }),
    });

    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toContain('Failed to approve adjustment');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to approve adjustment',
      expect.objectContaining({
        action: 'inventory.adjustment.approve',
        status: 'failed',
        errorMessage: 'Constraint violation',
      }),
    );
  });
});

// =====================================================================
// Location 5: handleApproveAdjustment — rejection update error
// =====================================================================

describe('POST /admin/inventory/adjustments/:id/approve — rejection update DB error', () => {
  it('should return 500 when rejecting adjustment fails', async () => {
    // 1st execute: adjustment lookup — success (no new_status needed for reject)
    mockChain.execute.mockResolvedValueOnce({
      data: {
        id: 'adj-003',
        device_id: 'de00000000000003',
        approval_status: 'pending',
      },
      error: null,
    });
    // 2nd execute: rejection update — error
    mockChain.execute.mockResolvedValueOnce({
      data: null,
      error: { message: 'Disk full' },
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/adj-003/approve',
      body: JSON.stringify({ action: 'reject', rejection_reason: 'Duplicate' }),
    });

    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toContain('Failed to reject adjustment');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to reject adjustment',
      expect.objectContaining({
        action: 'inventory.adjustment.reject',
        status: 'failed',
        errorMessage: 'Disk full',
      }),
    );
  });
});
