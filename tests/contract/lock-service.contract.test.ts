/**
 * Lock Service - API Contract Tests
 *
 * Validates that all lock service and handover endpoints conform to
 * their API contracts: request validation, response shapes,
 * status codes, headers, and error handling.
 */

import {
  createAPIGatewayEvent,
  parseResponseBody,
  expectSuccessResponse,
  expectErrorResponse,
  expectCORSHeaders,
} from '../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
};

const mockSupabaseClient = {
  from: jest.fn(() => mockQueryBuilder),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

const mockLockDevice = jest.fn();
const mockUnlockDevice = jest.fn();
const mockGetLockStatus = jest.fn();
const mockProcessAutomatedLocks = jest.fn();

jest.mock('../../services/lock-service/src/lock-management-service', () => ({
  LockManagementService: jest.fn().mockImplementation(() => ({
    lockDevice: mockLockDevice,
    unlockDevice: mockUnlockDevice,
    getLockStatus: mockGetLockStatus,
    processAutomatedLocks: mockProcessAutomatedLocks,
  })),
}));

const mockCheckHandoverReadiness = jest.fn();
const mockInitiateHandover = jest.fn();
const mockVerifyCustomerIdentity = jest.fn();
const mockVerifyDepositPayment = jest.fn();
const mockRecordDeviceCondition = jest.fn();
const mockCompleteHandover = jest.fn();
const mockGetHandoverStatus = jest.fn();

jest.mock('../../services/lock-service/src/handover-service', () => ({
  HandoverService: jest.fn().mockImplementation(() => ({
    checkHandoverReadiness: mockCheckHandoverReadiness,
    initiateHandover: mockInitiateHandover,
    verifyCustomerIdentity: mockVerifyCustomerIdentity,
    verifyDepositPayment: mockVerifyDepositPayment,
    recordDeviceCondition: mockRecordDeviceCondition,
    completeHandover: mockCompleteHandover,
    getHandoverStatus: mockGetHandoverStatus,
  })),
}));

import { handler } from '../../services/lock-service/src/index';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Lock Service Contract Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // POST /locks/lock
  // =========================================================================
  describe('POST /locks/lock', () => {
    it('should return 200 with lock details on success', async () => {
      mockLockDevice.mockResolvedValue(undefined);
      mockGetLockStatus.mockResolvedValue({
        device_id: 'dev_001',
        lock_status: 'locked',
        locked_at: '2024-01-15T10:00:00Z',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/lock',
        body: JSON.stringify({ device_id: 'dev_001', reason: 'Missed payment' }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('device_id', 'dev_001');
      expect(body).toHaveProperty('lock_status', 'locked');
      expect(body).toHaveProperty('locked_at');
    });

    it('should return 400 when device_id is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/lock',
        body: JSON.stringify({ reason: 'Missed payment' }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
      expect(body).toHaveProperty('required');
      expect((body as Record<string, unknown>).required).toEqual(
        expect.arrayContaining(['device_id', 'reason']),
      );
    });

    it('should return 400 when reason is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/lock',
        body: JSON.stringify({ device_id: 'dev_001' }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 500 when lock operation fails', async () => {
      mockLockDevice.mockRejectedValue(new Error('Trustonic API unavailable'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/lock',
        body: JSON.stringify({ device_id: 'dev_001', reason: 'Test' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to lock device');
    });
  });

  // =========================================================================
  // POST /locks/unlock
  // =========================================================================
  describe('POST /locks/unlock', () => {
    it('should return 200 with unlock details on success', async () => {
      mockUnlockDevice.mockResolvedValue(undefined);
      mockGetLockStatus.mockResolvedValue({
        device_id: 'dev_001',
        lock_status: 'unlocked',
        unlocked_at: '2024-01-15T12:00:00Z',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/unlock',
        body: JSON.stringify({ device_id: 'dev_001', reason: 'Payment received' }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('device_id', 'dev_001');
      expect(body).toHaveProperty('lock_status', 'unlocked');
      expect(body).toHaveProperty('unlocked_at');
    });

    it('should return 400 when device_id is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/unlock',
        body: JSON.stringify({ reason: 'Payment received' }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
      expect(body).toHaveProperty('required');
    });

    it('should return 400 when reason is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/unlock',
        body: JSON.stringify({ device_id: 'dev_001' }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 500 when unlock operation fails', async () => {
      mockUnlockDevice.mockRejectedValue(new Error('Trustonic timeout'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/unlock',
        body: JSON.stringify({ device_id: 'dev_001', reason: 'Test' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to unlock device');
    });
  });

  // =========================================================================
  // GET /locks/{deviceId}
  // =========================================================================
  describe('GET /locks/{deviceId}', () => {
    it('should return 200 with device lock status', async () => {
      mockGetLockStatus.mockResolvedValue({
        device_id: 'dev_001',
        lock_status: 'locked',
        locked_at: '2024-01-15T10:00:00Z',
        unlocked_at: null,
        lock_reason: 'Missed payment',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/locks/dev_001',
        pathParameters: { deviceId: 'dev_001' },
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('device_id', 'dev_001');
      expect(body).toHaveProperty('lock_status');
    });

    it('should return 400 when deviceId is not provided', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/locks/undefined',
        pathParameters: { deviceId: undefined as unknown as string },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'device_id is required');
    });

    it('should return 500 when status lookup fails', async () => {
      mockGetLockStatus.mockRejectedValue(new Error('Device not found'));

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/locks/dev_999',
        pathParameters: { deviceId: 'dev_999' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to get lock status');
    });
  });

  // =========================================================================
  // POST /locks/process-scheduled
  // =========================================================================
  describe('POST /locks/process-scheduled', () => {
    it('should return 200 with processing result on success', async () => {
      mockProcessAutomatedLocks.mockResolvedValue({
        processed: 3,
        locked: 2,
        failed: 1,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/process-scheduled',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('result');
    });

    it('should return 500 when automated processing fails', async () => {
      mockProcessAutomatedLocks.mockRejectedValue(new Error('Processing error'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/process-scheduled',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to process automated locks');
    });
  });

  // =========================================================================
  // POST /handovers/check-readiness
  // =========================================================================
  describe('POST /handovers/check-readiness', () => {
    it('should return 200 with readiness data on success', async () => {
      mockCheckHandoverReadiness.mockResolvedValue({
        ready: true,
        checks: {
          loan_approved: true,
          kyc_verified: true,
          deposit_paid: true,
          device_available: true,
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/check-readiness',
        body: JSON.stringify({ loan_id: 'loan_001' }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('ready', true);
      expect(body).toHaveProperty('checks');
    });

    it('should return 400 when loan_id is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/check-readiness',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'loan_id is required');
    });

    it('should return 500 when readiness check fails', async () => {
      mockCheckHandoverReadiness.mockRejectedValue(new Error('Loan not found'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/check-readiness',
        body: JSON.stringify({ loan_id: 'loan_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // POST /handovers/initiate
  // =========================================================================
  describe('POST /handovers/initiate', () => {
    const validHandoverBody = {
      loan_id: 'loan_001',
      device_id: 'dev_001',
      customer_id: 'cust_001',
      distributor_id: 'dist_001',
      handover_location: 'Harare CBD Branch',
      handed_over_by: 'agent_001',
    };

    it('should return 200 with handover details on success', async () => {
      mockInitiateHandover.mockResolvedValue({
        id: 'handover_001',
        status: 'initiated',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/initiate',
        body: JSON.stringify(validHandoverBody),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('handover_id', 'handover_001');
      expect(body).toHaveProperty('status', 'initiated');
    });

    it('should return 400 when loan_id is missing', async () => {
      const body = { ...validHandoverBody };
      delete (body as Record<string, unknown>).loan_id;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/initiate',
        body: JSON.stringify(body),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error', 'Missing required fields');
    });

    it('should return 400 when device_id is missing', async () => {
      const body = { ...validHandoverBody };
      delete (body as Record<string, unknown>).device_id;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/initiate',
        body: JSON.stringify(body),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 400 when customer_id is missing', async () => {
      const body = { ...validHandoverBody };
      delete (body as Record<string, unknown>).customer_id;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/initiate',
        body: JSON.stringify(body),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 400 when distributor_id is missing', async () => {
      const body = { ...validHandoverBody };
      delete (body as Record<string, unknown>).distributor_id;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/initiate',
        body: JSON.stringify(body),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 400 when handover_location is missing', async () => {
      const body = { ...validHandoverBody };
      delete (body as Record<string, unknown>).handover_location;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/initiate',
        body: JSON.stringify(body),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 400 when handed_over_by is missing', async () => {
      const body = { ...validHandoverBody };
      delete (body as Record<string, unknown>).handed_over_by;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/initiate',
        body: JSON.stringify(body),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 500 when initiation fails', async () => {
      mockInitiateHandover.mockRejectedValue(new Error('Device not enrolled'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/initiate',
        body: JSON.stringify(validHandoverBody),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to initiate handover');
    });
  });

  // =========================================================================
  // POST /handovers/verify-identity
  // =========================================================================
  describe('POST /handovers/verify-identity', () => {
    it('should return 200 when identity is verified', async () => {
      mockVerifyCustomerIdentity.mockResolvedValue({
        verified: true,
        message: 'Identity verified successfully',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/verify-identity',
        body: JSON.stringify({ handover_id: 'handover_001', id_number: '63-123456A47' }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('verified', true);
    });

    it('should return 400 when handover_id is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/verify-identity',
        body: JSON.stringify({ id_number: '63-123456A47' }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
      expect((body as Record<string, unknown>).required).toEqual(
        expect.arrayContaining(['handover_id', 'id_number']),
      );
    });

    it('should return 400 when id_number is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/verify-identity',
        body: JSON.stringify({ handover_id: 'handover_001' }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 400 when identity verification fails', async () => {
      mockVerifyCustomerIdentity.mockResolvedValue({
        verified: false,
        message: 'ID number does not match records',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/verify-identity',
        body: JSON.stringify({ handover_id: 'handover_001', id_number: '00-000000X00' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('verified', false);
    });

    it('should return 500 when verification throws', async () => {
      mockVerifyCustomerIdentity.mockRejectedValue(new Error('Lookup failure'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/verify-identity',
        body: JSON.stringify({ handover_id: 'handover_001', id_number: '63-123456A47' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // POST /handovers/verify-deposit
  // =========================================================================
  describe('POST /handovers/verify-deposit', () => {
    it('should return 200 when deposit is verified', async () => {
      mockVerifyDepositPayment.mockResolvedValue({
        verified: true,
        message: 'Deposit verified',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/verify-deposit',
        body: JSON.stringify({ handover_id: 'handover_001' }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('verified', true);
    });

    it('should return 400 when handover_id is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/verify-deposit',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'handover_id is required');
    });

    it('should return 400 when deposit not verified', async () => {
      mockVerifyDepositPayment.mockResolvedValue({
        verified: false,
        message: 'Deposit payment not found',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/verify-deposit',
        body: JSON.stringify({ handover_id: 'handover_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 500 when deposit verification throws', async () => {
      mockVerifyDepositPayment.mockRejectedValue(new Error('Payment service down'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/verify-deposit',
        body: JSON.stringify({ handover_id: 'handover_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // POST /handovers/device-condition
  // =========================================================================
  describe('POST /handovers/device-condition', () => {
    it('should return 200 with success message', async () => {
      mockRecordDeviceCondition.mockResolvedValue(undefined);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/device-condition',
        body: JSON.stringify({
          handover_id: 'handover_001',
          device_condition: {
            screen: 'intact',
            body: 'no_scratches',
            power: 'on',
            accessories: ['charger', 'box'],
          },
        }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message', 'Device condition recorded');
    });

    it('should return 400 when handover_id is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/device-condition',
        body: JSON.stringify({ device_condition: { screen: 'intact' } }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
    });

    it('should return 400 when device_condition is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/device-condition',
        body: JSON.stringify({ handover_id: 'handover_001' }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 500 when recording fails', async () => {
      mockRecordDeviceCondition.mockRejectedValue(new Error('Storage error'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/device-condition',
        body: JSON.stringify({
          handover_id: 'handover_001',
          device_condition: { screen: 'intact' },
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // POST /handovers/complete
  // =========================================================================
  describe('POST /handovers/complete', () => {
    it('should return 200 with completion result on success', async () => {
      mockCompleteHandover.mockResolvedValue({
        success: true,
        handover_id: 'handover_001',
        status: 'completed',
        loan_activated: true,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/complete',
        body: JSON.stringify({ handover_id: 'handover_001' }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('status', 'completed');
    });

    it('should return 400 when handover_id is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/complete',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'handover_id is required');
    });

    it('should return 500 when completion fails', async () => {
      mockCompleteHandover.mockRejectedValue(new Error('Prerequisites not met'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/complete',
        body: JSON.stringify({ handover_id: 'handover_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to complete handover');
    });
  });

  // =========================================================================
  // GET /handovers/{handoverId}
  // =========================================================================
  describe('GET /handovers/{handoverId}', () => {
    it('should return 200 with handover status', async () => {
      mockGetHandoverStatus.mockResolvedValue({
        id: 'handover_001',
        loan_id: 'loan_001',
        device_id: 'dev_001',
        customer_id: 'cust_001',
        status: 'identity_verified',
        identity_verified: true,
        deposit_verified: false,
        device_condition_verified: false,
        created_at: '2024-01-15T10:00:00Z',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/handovers/handover_001',
        pathParameters: { handoverId: 'handover_001' },
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('id', 'handover_001');
      expect(body).toHaveProperty('status');
    });

    it('should return 400 when handoverId is not provided', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/handovers/undefined',
        pathParameters: { handoverId: undefined as unknown as string },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'handover_id is required');
    });

    it('should return 500 when status lookup throws', async () => {
      mockGetHandoverStatus.mockRejectedValue(new Error('Not found'));

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/handovers/handover_999',
        pathParameters: { handoverId: 'handover_999' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to get handover status');
    });
  });

  // =========================================================================
  // 404 - Unknown routes
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown lock paths', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        path: '/locks/unknown/route',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Not Found');
    });

    it('should return 404 for unknown handover paths', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/unknown',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
    });

    it('should include proper headers on 404 responses', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/nonexistent',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://admin.lynia.finance');
    });
  });

  // =========================================================================
  // Top-level error handling
  // =========================================================================
  describe('Top-level error handling', () => {
    it('should return 500 on unexpected errors', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/lock',
        body: '<<<INVALID>>>',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });
});
