/**
 * Payment Handlers — requestId in Error Responses
 *
 * Spot-check tests verifying that when a payment handler encounters an
 * unexpected error, the 500 response body includes `requestId` in the
 * `details` object so that support can correlate logs.
 *
 * Tests 3 representative handlers:
 *   - handleGetPayments (list endpoint)
 *   - handleConfirmPayment (action endpoint)
 *   - handleReconcilePayment (action endpoint)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { APIGatewayProxyEvent } from 'aws-lambda';

// ============================================================
// MOCK SETUP
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockQuery = jest.fn();
const mockQueryOne = jest.fn();

jest.mock('../../../services/shared/clients/database', () => ({
  query: (...args: any[]) => mockQuery(...args),
  queryOne: (...args: any[]) => mockQueryOne(...args),
}));

jest.mock('../../../services/shared/utils/secrets', () => ({
  getSecret: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../../../services/shared/middleware/authorization', () => ({
  isAdminOrManager: jest.fn(() => true),
}));

// Import handlers after mocks
import {
  handleGetPayments,
  handleConfirmPayment,
  handleReconcilePayment,
} from '../../../services/admin-service/src/handlers/payments';

// ============================================================
// TEST HELPERS
// ============================================================

const TEST_REQUEST_ID = 'req-abc-12345';

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    path: '/api/v1/payments',
    httpMethod: 'GET',
    headers: { origin: 'https://d1qwfy2tsdmpe4.cloudfront.net' },
    queryStringParameters: null,
    pathParameters: null,
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {
      requestId: TEST_REQUEST_ID,
    } as any,
    ...overrides,
  };
}

const MOCK_AUTH: any = { userId: 'admin-user-1', roles: ['admin'] };

// ============================================================
// TESTS
// ============================================================

describe('Payment handlers include requestId in 500 error responses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handleGetPayments includes requestId in error details when DB throws', async () => {
    mockQueryOne.mockRejectedValue(new Error('Connection refused'));

    const event = makeEvent();
    const result = await handleGetPayments(event, {}, MOCK_AUTH);

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unexpected error/i);
    expect(body.details).toBeDefined();
    expect(body.details.requestId).toBe(TEST_REQUEST_ID);
    // Must not leak internal error message
    expect(body.error).not.toMatch(/Connection refused/);
  });

  it('handleConfirmPayment includes requestId in error details when DB throws', async () => {
    mockQueryOne.mockRejectedValue(new Error('Deadlock detected'));

    const event = makeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ notes: 'Confirming payment' }),
    });

    const result = await handleConfirmPayment(event, { id: 'pay-123' }, MOCK_AUTH);

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.details).toBeDefined();
    expect(body.details.requestId).toBe(TEST_REQUEST_ID);
    expect(body.error).not.toMatch(/Deadlock/);
  });

  it('handleReconcilePayment includes requestId in error details when DB throws', async () => {
    mockQueryOne.mockRejectedValue(new Error('Relation "payments" does not exist'));

    const event = makeEvent({ httpMethod: 'POST' });

    const result = await handleReconcilePayment(event, { id: 'pay-456' }, MOCK_AUTH);

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.details).toBeDefined();
    expect(body.details.requestId).toBe(TEST_REQUEST_ID);
    expect(body.error).not.toMatch(/Relation/);
  });
});
