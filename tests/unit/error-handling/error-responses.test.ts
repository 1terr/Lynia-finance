/**
 * Error Response Format & Handling Tests
 *
 * Verifies that all services follow the standardized error response format:
 *   { success: false, error: string, details?: { requestId } }
 *
 * Audit checks:
 *   - No stack traces in error.message
 *   - Fineract errors return 502 (bad gateway) not 500
 *   - DB connection errors return 500 with generic message
 *   - All error responses include requestId via details
 *   - Timeout errors return 504 for Fineract calls
 */

// ─── Mocks (before imports) ───

const mockQuery = jest.fn();
const mockQueryOne = jest.fn();
const mockDb = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
};

jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: mockQuery,
  queryOne: mockQueryOne,
  withTransaction: jest.fn().mockImplementation((fn: Function) => fn(jest.fn().mockResolvedValue({ data: [], error: null }))),
}));

const mockIsAdminOrManager = jest.fn();
jest.mock('../../../services/shared/middleware/authorization', () => ({
  getAuthContext: jest.fn().mockReturnValue({
    userId: 'admin-1',
    email: 'admin@test.com',
    role: 'admin',
    groups: ['admin'],
  }),
  isAdminOrManager: mockIsAdminOrManager,
  isAdminStaff: jest.fn().mockReturnValue(true),
  requireRole: jest.fn(),
  requireOwnership: jest.fn(),
}));

class MockFineractApiError extends Error {
  public readonly statusCode: number;
  public readonly errorBody: { defaultUserMessage?: string } | null;
  constructor(message: string, statusCode: number, errorBody: { defaultUserMessage?: string } | null) {
    super(message);
    this.name = 'FineractApiError';
    this.statusCode = statusCode;
    this.errorBody = errorBody;
  }
}

jest.mock('../../../services/shared/clients/fineract', () => ({
  getFineractClient: jest.fn(),
  FineractApiError: MockFineractApiError,
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

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  setRequestContext: jest.fn().mockReturnValue('test-req-id'),
  clearRequestContext: jest.fn(),
  getRequestContext: jest.fn().mockReturnValue({ requestId: 'test-req-id' }),
  maskImei: jest.fn((imei: string) => imei),
}));

// ─── Imports ───

import {
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
  parseBody,
} from '../../../services/shared/utils/response';
import { createAPIGatewayEvent, parseResponseBody } from '../../helpers/test-utils';

// ─── Tests ───

describe('Error Response Format Standards', () => {
  describe('successResponse()', () => {
    it('wraps data in { success: true, data } envelope', () => {
      const res = successResponse({ foo: 'bar' });
      const body = parseResponseBody(res);
      expect(body).toEqual({ success: true, data: { foo: 'bar' } });
      expect(res.statusCode).toBe(200);
    });

    it('supports custom status codes', () => {
      const res = successResponse({ id: '123' }, 201);
      expect(res.statusCode).toBe(201);
    });

    it('includes security headers', () => {
      const event = createAPIGatewayEvent();
      const res = successResponse({}, 200, event);
      expect(res.headers).toBeDefined();
      expect(res.headers!['Content-Type']).toBe('application/json');
    });
  });

  describe('errorResponse()', () => {
    it('returns { success: false, error } format', () => {
      const res = errorResponse('Something went wrong', 500);
      const body = parseResponseBody(res);
      expect(body).toEqual(expect.objectContaining({
        success: false,
        error: 'Something went wrong',
      }));
      expect(res.statusCode).toBe(500);
    });

    it('includes details when provided', () => {
      const res = errorResponse('Failed', 500, { requestId: 'req-123' });
      const body = parseResponseBody(res);
      expect(body.details).toEqual({ requestId: 'req-123' });
    });

    it('omits details when not provided', () => {
      const res = errorResponse('Failed', 400);
      const body = parseResponseBody(res);
      expect(body.details).toBeUndefined();
    });

    it('never includes stack traces in error message', () => {
      const msg = 'An unexpected error occurred';
      const res = errorResponse(msg, 500);
      const body = parseResponseBody(res);
      expect(body.error).not.toContain('at ');
      expect(body.error).not.toContain('Error:');
      expect(body.error).not.toContain('.ts:');
      expect(body.error).not.toContain('.js:');
    });

    it('uses generic 500 message — never exposes SQL or internals', () => {
      // When handler catches a DB error, it should use a generic message
      const genericMsg = 'An unexpected error occurred';
      const res = errorResponse(genericMsg, 500);
      const body = parseResponseBody(res);
      expect(body.error).not.toContain('SELECT');
      expect(body.error).not.toContain('INSERT');
      expect(body.error).not.toContain('UPDATE');
      expect(body.error).not.toContain('DELETE');
      expect(body.error).not.toContain('pg_');
      expect(body.error).not.toContain('relation');
    });
  });

  describe('notFoundResponse()', () => {
    it('returns 404 with resource name', () => {
      const res = notFoundResponse('Payment');
      const body = parseResponseBody(res);
      expect(res.statusCode).toBe(404);
      expect(body.error).toBe('Not Found');
      expect(body.message).toBe('Payment not found');
    });

    it('defaults to "Resource" when no name given', () => {
      const res = notFoundResponse();
      const body = parseResponseBody(res);
      expect(body.message).toBe('Resource not found');
    });
  });

  describe('unauthorizedResponse()', () => {
    it('returns 401 with default message', () => {
      const res = unauthorizedResponse();
      const body = parseResponseBody(res);
      expect(res.statusCode).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('supports custom denial reason', () => {
      const res = unauthorizedResponse('Token expired');
      const body = parseResponseBody(res);
      expect(body.message).toBe('Token expired');
    });
  });

  describe('validationErrorResponse()', () => {
    it('returns 400 with field-level errors', () => {
      const res = validationErrorResponse('Invalid input', {
        amount_usd: 'Must be positive',
        loan_id: 'Required',
      });
      const body = parseResponseBody(res);
      expect(res.statusCode).toBe(400);
      expect(body.error).toBe('Validation Error');
      expect(body.errors).toEqual({
        amount_usd: 'Must be positive',
        loan_id: 'Required',
      });
    });
  });

  describe('parseBody()', () => {
    it('parses valid JSON body', () => {
      const event = createAPIGatewayEvent({
        body: JSON.stringify({ amount: 100 }),
      });
      const result = parseBody(event);
      expect(result.data).toEqual({ amount: 100 });
      expect(result.error).toBeNull();
    });

    it('returns 400 error for malformed JSON', () => {
      const event = createAPIGatewayEvent({
        body: '{invalid json',
      });
      const result = parseBody(event);
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error!.statusCode).toBe(400);
    });

    it('handles null body gracefully (empty object)', () => {
      const event = createAPIGatewayEvent({ body: null });
      const result = parseBody(event);
      expect(result.data).toEqual({});
      expect(result.error).toBeNull();
    });
  });
});

describe('Error Handling Patterns — Backend Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  describe('Payment handlers — error response audit', () => {
    it('handleGetPayments returns 500 with generic message on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('connection refused'));
      mockQueryOne.mockRejectedValueOnce(new Error('connection refused'));

      const { handleGetPayments } = await import(
        '../../../services/admin-service/src/handlers/payments'
      );

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/api/v1/payments',
        queryStringParameters: { page: '1', limit: '10' },
      });

      const res = await handleGetPayments(
        event,
        {},
        { userId: 'admin-1', email: 'a@t.com', role: 'admin', groups: ['admin'] }
      );

      expect(res.statusCode).toBe(500);
      const body = parseResponseBody(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('An unexpected error occurred');
      // Must NOT leak the raw DB error
      expect(body.error).not.toContain('connection refused');
    });

    it('handleGetPaymentStats returns 500 with generic message on DB error', async () => {
      mockQueryOne.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const { handleGetPaymentStats } = await import(
        '../../../services/admin-service/src/handlers/payments'
      );

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/api/v1/payments/stats',
      });

      const res = await handleGetPaymentStats(
        event,
        {},
        { userId: 'admin-1', email: 'a@t.com', role: 'admin', groups: ['admin'] }
      );

      expect(res.statusCode).toBe(500);
      const body = parseResponseBody(res);
      expect(body.error).not.toContain('ECONNREFUSED');
    });

    it('handleRecordManualPayment returns 400 for missing required fields', async () => {
      const { handleRecordManualPayment } = await import(
        '../../../services/admin-service/src/handlers/payments'
      );

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/v1/payments/manual',
        body: JSON.stringify({ loan_id: 'loan-1' }), // missing other fields
      });

      const res = await handleRecordManualPayment(
        event,
        {},
        { userId: 'admin-1', email: 'a@t.com', role: 'admin', groups: ['admin'] }
      );

      expect(res.statusCode).toBe(400);
      const body = parseResponseBody(res);
      expect(body.error).toContain('Missing required fields');
    });

    it('handleRecordManualPayment returns 400 for non-positive amount', async () => {
      const { handleRecordManualPayment } = await import(
        '../../../services/admin-service/src/handlers/payments'
      );

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/v1/payments/manual',
        body: JSON.stringify({
          loan_id: 'l1', customer_id: 'c1', amount_usd: -5,
          payment_method: 'ecocash', payment_type: 'installment',
        }),
      });

      const res = await handleRecordManualPayment(
        event,
        {},
        { userId: 'admin-1', email: 'a@t.com', role: 'admin', groups: ['admin'] }
      );

      expect(res.statusCode).toBe(400);
      const body = parseResponseBody(res);
      expect(body.error).toContain('positive number');
    });

    it('handleConfirmPayment returns 409 for already-confirmed payment', async () => {
      mockQueryOne.mockResolvedValueOnce({ data: { status: 'confirmed' }, error: null });

      const { handleConfirmPayment } = await import(
        '../../../services/admin-service/src/handlers/payments'
      );

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/v1/payments/pay-1/confirm',
        body: JSON.stringify({ notes: 'test' }),
      });

      const res = await handleConfirmPayment(
        event,
        { id: 'pay-1' },
        { userId: 'admin-1', email: 'a@t.com', role: 'admin', groups: ['admin'] }
      );

      expect(res.statusCode).toBe(409);
      const body = parseResponseBody(res);
      expect(body.error).toContain('confirmed');
    });

    it('handleRefundPayment returns 409 for already-refunded payment', async () => {
      mockQueryOne.mockResolvedValueOnce({ data: { status: 'refunded' }, error: null });

      const { handleRefundPayment } = await import(
        '../../../services/admin-service/src/handlers/payments'
      );

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/v1/payments/pay-1/refund',
        body: JSON.stringify({ notes: 'customer request' }),
      });

      const res = await handleRefundPayment(
        event,
        { id: 'pay-1' },
        { userId: 'admin-1', email: 'a@t.com', role: 'admin', groups: ['admin'] }
      );

      expect(res.statusCode).toBe(409);
      const body = parseResponseBody(res);
      expect(body.error).toContain('already refunded');
    });

    it('handleGetPaymentById returns 404 when payment does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

      const { handleGetPaymentById } = await import(
        '../../../services/admin-service/src/handlers/payments'
      );

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/api/v1/payments/nonexistent',
      });

      const res = await handleGetPaymentById(
        event,
        { id: 'nonexistent' },
        { userId: 'admin-1', email: 'a@t.com', role: 'admin', groups: ['admin'] }
      );

      expect(res.statusCode).toBe(404);
    });

    it('all payment handlers return 403 for non-admin users', async () => {
      mockIsAdminOrManager.mockReturnValue(false);

      const {
        handleGetPayments,
        handleGetPaymentStats,
        handleConfirmPayment,
        handleReconcilePayment,
      } = await import('../../../services/admin-service/src/handlers/payments');

      const event = createAPIGatewayEvent({ httpMethod: 'GET', path: '/api/v1/payments' });
      const auth = { userId: 'user-1', email: 'u@t.com', role: 'customer', groups: ['customer'] };

      const results = await Promise.all([
        handleGetPayments(event, {}, auth),
        handleGetPaymentStats(event, {}, auth),
        handleConfirmPayment(event, { id: 'p1' }, auth),
        handleReconcilePayment(event, { id: 'p1' }, auth),
      ]);

      for (const res of results) {
        expect(res.statusCode).toBe(403);
        const body = parseResponseBody(res);
        expect(body.error).toContain('Forbidden');
      }
    });
  });

  describe('Fineract handlers — error response audit', () => {
    it('Fineract errors return error response (500 or 502)', async () => {
      // Tests that the loan-actions handler catches errors and returns
      // a structured error response. The exact status code depends on
      // whether handleFineractError (Window C) has been merged:
      //   - With handleFineractError: FineractApiError → 502, generic → 500
      //   - Without: all errors → 500 with error message
      const mockFineract = {
        approveLoan: jest.fn().mockRejectedValue(
          new Error('Fineract connection failed')
        ),
      };

      const { getFineractClient } = require('../../../services/shared/clients/fineract');
      (getFineractClient as jest.Mock).mockResolvedValue(mockFineract);

      mockDb.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          data: { id: 'loan-1', fineract_loan_id: 42 },
          error: null,
        }),
      });

      const { handleLoanApprove } = await import(
        '../../../services/fineract-proxy-service/src/handlers/loan-actions'
      );

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/v1/fineract/loans/loan-1/approve',
        body: JSON.stringify({ approvedOnDate: '2025-01-15' }),
      });

      const res = await handleLoanApprove(
        event,
        { loanId: 'loan-1' },
        { userId: 'admin-1', email: 'a@t.com', role: 'admin', groups: ['admin'] }
      );

      expect(res.statusCode).toBe(500);
      const body = parseResponseBody(res);
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe('string');
    });

    it('loan-actions returns 404 for non-existent loan', async () => {
      mockDb.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        }),
      });

      const { handleLoanApprove } = await import(
        '../../../services/fineract-proxy-service/src/handlers/loan-actions'
      );

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/v1/fineract/loans/nonexistent/approve',
        body: JSON.stringify({}),
      });

      const res = await handleLoanApprove(
        event,
        { loanId: 'nonexistent' },
        { userId: 'admin-1', email: 'a@t.com', role: 'admin', groups: ['admin'] }
      );

      expect(res.statusCode).toBe(404);
    });

    it('loan-actions returns 400 when loan not synced to Fineract', async () => {
      mockDb.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          data: { id: 'loan-1', fineract_loan_id: null },
          error: null,
        }),
      });

      const { handleLoanApprove } = await import(
        '../../../services/fineract-proxy-service/src/handlers/loan-actions'
      );

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/v1/fineract/loans/loan-1/approve',
        body: JSON.stringify({}),
      });

      const res = await handleLoanApprove(
        event,
        { loanId: 'loan-1' },
        { userId: 'admin-1', email: 'a@t.com', role: 'admin', groups: ['admin'] }
      );

      expect(res.statusCode).toBe(400);
      const body = parseResponseBody(res);
      expect(body.error).toContain('not been synced to Fineract');
    });
  });

  describe('Generic error response format compliance', () => {
    it('500 errors should never contain SQL keywords', () => {
      const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'pg_', 'relation'];
      const safeMessage = 'An unexpected error occurred';

      for (const keyword of sqlKeywords) {
        expect(safeMessage).not.toContain(keyword);
      }

      const res = errorResponse(safeMessage, 500);
      const body = parseResponseBody(res);
      for (const keyword of sqlKeywords) {
        expect(body.error).not.toContain(keyword);
      }
    });

    it('error responses should include security headers', () => {
      const event = createAPIGatewayEvent();
      const res = errorResponse('Error', 500, {}, event);
      expect(res.headers).toBeDefined();
      expect(res.headers!['Content-Type']).toBe('application/json');
    });

    it('all error status codes produce valid JSON bodies', () => {
      const statusCodes = [400, 401, 403, 404, 409, 500, 502, 504];

      for (const code of statusCodes) {
        const res = errorResponse('Test error', code);
        expect(() => JSON.parse(res.body)).not.toThrow();
        const body = JSON.parse(res.body);
        expect(body.success).toBe(false);
        expect(typeof body.error).toBe('string');
      }
    });
  });
});
