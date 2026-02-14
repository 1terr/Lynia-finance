/**
 * Advanced Loan Features - Contract Tests (Phase 8)
 *
 * Validates penalty configuration, write-off, and rescheduling
 * API contracts: request validation, response shapes, error handling,
 * and authorization enforcement.
 */

import {
  createAPIGatewayEvent,
  parseResponseBody,
  expectSuccessResponse,
  expectErrorResponse,
} from '../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mocks - declared before importing handlers
// ---------------------------------------------------------------------------

// Mock database client
const mockExecute = jest.fn();
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  execute: mockExecute,
};

jest.mock('../../services/shared/clients/database', () => ({
  db: {
    from: jest.fn().mockReturnValue(mockQueryBuilder),
  },
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

// Import handler after mocks are in place
import { handler } from '../../services/payment-service/src/advanced-loan-handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createAuthEvent(
  overrides: Partial<Parameters<typeof createAPIGatewayEvent>[0]> & {
    roles?: string;
    userId?: string;
  } = {}
) {
  const { roles = 'admin', userId = 'user_admin_001', ...rest } = overrides;
  return createAPIGatewayEvent({
    ...rest,
    requestContext: {
      ...createAPIGatewayEvent(rest).requestContext,
      authorizer: {
        claims: {
          sub: userId,
          email: 'admin@lynia.finance',
          'cognito:groups': roles,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Advanced Loan Features Contract Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({ data: null, error: null });
  });

  // =========================================================================
  // PENALTY CONFIGURATION
  // =========================================================================
  describe('Penalty Configuration', () => {
    describe('POST /loans/penalties/configurations', () => {
      it('should return 201 when creating a valid penalty config', async () => {
        const configData = {
          penalty_type: 'late_fee',
          name: 'Standard Late Fee',
          calculation_method: 'flat',
          flat_amount_usd: 2.00,
          grace_period_days: 3,
          min_days_past_due: 1,
          recurrence: 'once',
          is_active: true,
          effective_from: '2026-01-01',
        };

        mockExecute.mockResolvedValueOnce({
          data: { id: 'config_001', ...configData },
          error: null,
        });
        // Audit log insert
        mockExecute.mockResolvedValueOnce({ data: null, error: null });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/penalties/configurations',
          body: JSON.stringify(configData),
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(201);
        const body = parseResponseBody(response);
        expect(body).toHaveProperty('success', true);
        expect((body as Record<string, unknown>).data).toHaveProperty('penalty_type', 'late_fee');
      });

      it('should reject invalid penalty type', async () => {
        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/penalties/configurations',
          body: JSON.stringify({
            penalty_type: 'invalid_type',
            name: 'Bad Config',
            calculation_method: 'flat',
            flat_amount_usd: 2.00,
            grace_period_days: 3,
            min_days_past_due: 1,
            recurrence: 'once',
            is_active: true,
            effective_from: '2026-01-01',
          }),
        });

        const response = await handler(event);
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
        const body = parseResponseBody(response);
        expect(body).toHaveProperty('success', false);
      });

      it('should reject flat method without flat_amount_usd', async () => {
        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/penalties/configurations',
          body: JSON.stringify({
            penalty_type: 'late_fee',
            name: 'Missing Amount',
            calculation_method: 'flat',
            grace_period_days: 3,
            min_days_past_due: 1,
            recurrence: 'once',
            is_active: true,
            effective_from: '2026-01-01',
          }),
        });

        const response = await handler(event);
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });

      it('should require admin or manager role', async () => {
        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/penalties/configurations',
          body: JSON.stringify({
            penalty_type: 'late_fee',
            name: 'Test',
            calculation_method: 'flat',
            flat_amount_usd: 2.00,
            grace_period_days: 3,
            min_days_past_due: 1,
            recurrence: 'once',
            is_active: true,
            effective_from: '2026-01-01',
          }),
          roles: 'customer',
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(403);
      });
    });

    describe('GET /loans/penalties/configurations', () => {
      it('should return 200 with list of configs', async () => {
        const { query: mockQuery } = require('../../services/shared/clients/database');
        mockQuery.mockResolvedValueOnce({
          data: [
            { id: 'cfg_1', penalty_type: 'late_fee', name: 'Late Fee' },
            { id: 'cfg_2', penalty_type: 'collection_fee', name: 'Collection Fee' },
          ],
          error: null,
        });

        const event = createAuthEvent({
          httpMethod: 'GET',
          path: '/loans/penalties/configurations',
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(200);
        const body = parseResponseBody(response);
        expect(body).toHaveProperty('success', true);
      });
    });
  });

  // =========================================================================
  // PENALTY APPLICATION
  // =========================================================================
  describe('Penalty Application', () => {
    describe('GET /loans/{loanId}/penalties/calculate', () => {
      it('should return 200 with calculations for eligible loan', async () => {
        // Mock loan lookup
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'loan_001',
            days_past_due: 10,
            outstanding_balance_usd: 200,
            product_id: 'prod_001',
            total_penalties_usd: 0,
            penalty_accrual_suspended: false,
          },
          error: null,
        });

        // Mock penalty configs query
        const { query: mockQuery } = require('../../services/shared/clients/database');
        mockQuery.mockResolvedValueOnce({
          data: [{
            id: 'cfg_001',
            penalty_type: 'late_fee',
            calculation_method: 'flat',
            flat_amount_usd: 2.00,
            grace_period_days: 3,
            min_days_past_due: 1,
            max_days_past_due: null,
            recurrence: 'once',
            max_applications: 1,
            max_penalty_amount_usd: 2.00,
            max_total_penalties_usd: null,
            max_penalty_percentage: null,
            is_active: true,
            name: 'Standard Late Fee',
          }],
          error: null,
        });

        // Mock application count check
        mockExecute.mockResolvedValueOnce({ data: [], error: null });
        // Mock recurrence check
        mockExecute.mockResolvedValueOnce({ data: [], error: null });

        const event = createAuthEvent({
          httpMethod: 'GET',
          path: '/loans/loan_001/penalties/calculate',
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(200);
        const body = parseResponseBody(response);
        expect(body).toHaveProperty('success', true);
      });

      it('should return empty array for loan with no DPD', async () => {
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'loan_002',
            days_past_due: 0,
            outstanding_balance_usd: 200,
            product_id: 'prod_001',
            penalty_accrual_suspended: false,
          },
          error: null,
        });

        const event = createAuthEvent({
          httpMethod: 'GET',
          path: '/loans/loan_002/penalties/calculate',
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(200);
        const body = parseResponseBody<{ success: boolean; data: unknown[] }>(response);
        expect(body.data).toEqual([]);
      });
    });

    describe('POST /loans/penalties/{penaltyId}/waive', () => {
      it('should require reason for waiver', async () => {
        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/penalties/pen_001/waive',
          body: JSON.stringify({}),
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(400);
        const body = parseResponseBody(response);
        expect(body).toHaveProperty('error');
      });

      it('should waive applied penalty with valid reason', async () => {
        // Mock penalty lookup
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'pen_001',
            loan_id: 'loan_001',
            amount_usd: 2.00,
            status: 'applied',
          },
          error: null,
        });
        // Mock update
        mockExecute.mockResolvedValueOnce({
          data: { id: 'pen_001', status: 'waived' },
          error: null,
        });
        // Mock duplicate loan update (first one via builder, second via raw query)
        mockExecute.mockResolvedValueOnce({ data: null, error: null });
        const { query: mockQuery } = require('../../services/shared/clients/database');
        mockQuery.mockResolvedValueOnce({ data: [], error: null });
        // Audit log
        mockExecute.mockResolvedValueOnce({ data: null, error: null });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/penalties/pen_001/waive',
          body: JSON.stringify({ reason: 'Customer hardship - waiving late fee' }),
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(200);
      });
    });
  });

  // =========================================================================
  // WRITE-OFFS
  // =========================================================================
  describe('Write-Offs', () => {
    describe('POST /loans/write-offs', () => {
      it('should return 201 when creating a valid write-off request', async () => {
        // Mock loan lookup
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'loan_001',
            customer_id: 'cust_001',
            status: 'defaulted',
            outstanding_balance_usd: 300,
          },
          error: null,
        });
        // Mock existing write-offs check
        mockExecute.mockResolvedValueOnce({ data: [], error: null });
        // Mock insert
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'wo_001',
            loan_id: 'loan_001',
            write_off_type: 'full',
            total_written_off: 300,
            status: 'pending',
          },
          error: null,
        });
        // Audit log
        mockExecute.mockResolvedValueOnce({ data: null, error: null });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/write-offs',
          body: JSON.stringify({
            loan_id: 'loan_001',
            write_off_type: 'full',
            write_off_reason: 'default_180',
            principal_written_off: 250,
            interest_written_off: 30,
            penalties_written_off: 20,
          }),
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(201);
        const body = parseResponseBody(response);
        expect(body).toHaveProperty('success', true);
      });

      it('should reject write-off for paid-off loan', async () => {
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'loan_002',
            customer_id: 'cust_001',
            status: 'paid_off',
            outstanding_balance_usd: 0,
          },
          error: null,
        });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/write-offs',
          body: JSON.stringify({
            loan_id: 'loan_002',
            write_off_type: 'full',
            write_off_reason: 'default_180',
            principal_written_off: 0,
          }),
        });

        const response = await handler(event);
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });

      it('should reject write-off exceeding outstanding balance', async () => {
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'loan_003',
            customer_id: 'cust_001',
            status: 'defaulted',
            outstanding_balance_usd: 100,
          },
          error: null,
        });
        mockExecute.mockResolvedValueOnce({ data: [], error: null });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/write-offs',
          body: JSON.stringify({
            loan_id: 'loan_003',
            write_off_type: 'partial',
            write_off_reason: 'uncollectable',
            principal_written_off: 200,
          }),
        });

        const response = await handler(event);
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });
    });

    describe('POST /loans/write-offs/{id}/approve', () => {
      it('should approve pending write-off', async () => {
        // Mock write-off lookup
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'wo_001',
            loan_id: 'loan_001',
            status: 'pending',
            total_written_off: 300,
            outstanding_after: 0,
            requested_by: 'user_other',
          },
          error: null,
        });
        // Mock update
        mockExecute.mockResolvedValueOnce({
          data: { id: 'wo_001', status: 'approved' },
          error: null,
        });
        // Mock loan update (raw query)
        const { query: mockQuery } = require('../../services/shared/clients/database');
        mockQuery.mockResolvedValueOnce({ data: [], error: null });
        // Audit log
        mockExecute.mockResolvedValueOnce({ data: null, error: null });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/write-offs/wo_001/approve',
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(200);
        const body = parseResponseBody(response);
        expect(body).toHaveProperty('success', true);
      });

      it('should prevent self-approval', async () => {
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'wo_002',
            loan_id: 'loan_001',
            status: 'pending',
            total_written_off: 300,
            requested_by: 'user_admin_001',
          },
          error: null,
        });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/write-offs/wo_002/approve',
          userId: 'user_admin_001',
        });

        const response = await handler(event);
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
        const body = parseResponseBody(response);
        expect(body).toHaveProperty('success', false);
      });
    });

    describe('POST /loans/write-offs/{id}/reject', () => {
      it('should require reason for rejection', async () => {
        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/write-offs/wo_001/reject',
          body: JSON.stringify({}),
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(400);
      });
    });

    describe('POST /loans/write-offs/{id}/reverse', () => {
      it('should require admin role for reversal', async () => {
        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/write-offs/wo_001/reverse',
          body: JSON.stringify({ reason: 'Erroneous write-off, customer paid' }),
          roles: 'support',
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(403);
      });
    });

    describe('GET /loans/write-offs/pending', () => {
      it('should return pending write-offs queue', async () => {
        mockExecute.mockResolvedValueOnce({
          data: [
            { id: 'wo_001', status: 'pending', total_written_off: 300 },
          ],
          error: null,
        });

        const event = createAuthEvent({
          httpMethod: 'GET',
          path: '/loans/write-offs/pending',
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(200);
      });
    });

    describe('GET /loans/{loanId}/write-offs/eligibility', () => {
      it('should return eligibility status for a loan', async () => {
        // Mock loan lookup
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'loan_001',
            days_past_due: 200,
            outstanding_balance_usd: 300,
            status: 'defaulted',
          },
          error: null,
        });
        // Mock existing write-offs
        mockExecute.mockResolvedValueOnce({ data: [], error: null });
        // Mock system_config
        mockExecute.mockResolvedValueOnce({
          data: { value: '180' },
          error: null,
        });

        const event = createAuthEvent({
          httpMethod: 'GET',
          path: '/loans/loan_001/write-offs/eligibility',
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(200);
        const body = parseResponseBody<{ success: boolean; data: { eligible: boolean } }>(response);
        expect(body.data.eligible).toBe(true);
      });
    });
  });

  // =========================================================================
  // RESCHEDULES
  // =========================================================================
  describe('Reschedules', () => {
    describe('POST /loans/reschedules', () => {
      it('should return 201 for valid term extension request', async () => {
        // Mock loan lookup
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'loan_001',
            customer_id: 'cust_001',
            status: 'active',
            loan_term_months: 6,
            interest_rate: 12,
            next_payment_amount_usd: 60,
            outstanding_balance_usd: 240,
            maturity_date: '2026-08-01',
            reschedule_count: 0,
            disbursed_at: '2026-02-01',
            monthly_installment_usd: 60,
          },
          error: null,
        });
        // Mock max reschedules config
        mockExecute.mockResolvedValueOnce({
          data: { value: '3' },
          error: null,
        });
        // Mock pending check
        mockExecute.mockResolvedValueOnce({ data: [], error: null });
        // Mock insert
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'rsch_001',
            loan_id: 'loan_001',
            reschedule_type: 'term_extension',
            status: 'pending',
          },
          error: null,
        });
        // Audit log
        mockExecute.mockResolvedValueOnce({ data: null, error: null });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/reschedules',
          body: JSON.stringify({
            loan_id: 'loan_001',
            reschedule_type: 'term_extension',
            reason: 'hardship',
            new_term_months: 9,
          }),
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(201);
        const body = parseResponseBody(response);
        expect(body).toHaveProperty('success', true);
      });

      it('should reject reschedule for paid-off loan', async () => {
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'loan_002',
            status: 'paid_off',
            reschedule_count: 0,
          },
          error: null,
        });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/reschedules',
          body: JSON.stringify({
            loan_id: 'loan_002',
            reschedule_type: 'term_extension',
            reason: 'hardship',
            new_term_months: 9,
          }),
        });

        const response = await handler(event);
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });

      it('should reject when max reschedule limit reached', async () => {
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'loan_003',
            status: 'active',
            reschedule_count: 3,
            loan_term_months: 6,
            interest_rate: 12,
          },
          error: null,
        });
        mockExecute.mockResolvedValueOnce({
          data: { value: '3' },
          error: null,
        });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/reschedules',
          body: JSON.stringify({
            loan_id: 'loan_003',
            reschedule_type: 'term_extension',
            reason: 'job_loss',
            new_term_months: 9,
          }),
        });

        const response = await handler(event);
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
        const body = parseResponseBody(response);
        expect(body).toHaveProperty('success', false);
      });

      it('should reject invalid reschedule type', async () => {
        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/reschedules',
          body: JSON.stringify({
            loan_id: 'loan_001',
            reschedule_type: 'invalid_type',
            reason: 'hardship',
          }),
        });

        const response = await handler(event);
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });
    });

    describe('POST /loans/reschedules/{id}/approve', () => {
      it('should approve pending reschedule', async () => {
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'rsch_001',
            loan_id: 'loan_001',
            status: 'pending',
            reschedule_type: 'term_extension',
          },
          error: null,
        });
        mockExecute.mockResolvedValueOnce({
          data: { id: 'rsch_001', status: 'approved' },
          error: null,
        });
        mockExecute.mockResolvedValueOnce({ data: null, error: null });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/reschedules/rsch_001/approve',
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(200);
      });
    });

    describe('POST /loans/reschedules/{id}/activate', () => {
      it('should activate approved reschedule and update loan terms', async () => {
        mockExecute.mockResolvedValueOnce({
          data: {
            id: 'rsch_001',
            loan_id: 'loan_001',
            status: 'approved',
            new_term_months: 9,
            new_interest_rate: 12,
            new_monthly_amount: 40,
            new_outstanding: 240,
            new_maturity_date: '2026-11-01',
          },
          error: null,
        });
        // Loan update (raw query)
        const { query: mockQuery } = require('../../services/shared/clients/database');
        mockQuery.mockResolvedValueOnce({ data: [], error: null });
        // Reschedule status update
        mockExecute.mockResolvedValueOnce({
          data: { id: 'rsch_001', status: 'active' },
          error: null,
        });
        // Audit log
        mockExecute.mockResolvedValueOnce({ data: null, error: null });

        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/reschedules/rsch_001/activate',
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(200);
      });
    });

    describe('POST /loans/reschedules/{id}/reject', () => {
      it('should require rejection reason', async () => {
        const event = createAuthEvent({
          httpMethod: 'POST',
          path: '/loans/reschedules/rsch_001/reject',
          body: JSON.stringify({}),
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(400);
      });
    });

    describe('GET /loans/reschedules/pending', () => {
      it('should return pending reschedule queue', async () => {
        mockExecute.mockResolvedValueOnce({
          data: [
            { id: 'rsch_001', status: 'pending', reschedule_type: 'term_extension' },
          ],
          error: null,
        });

        const event = createAuthEvent({
          httpMethod: 'GET',
          path: '/loans/reschedules/pending',
        });

        const response = await handler(event);
        expect(response.statusCode).toBe(200);
      });
    });
  });

  // =========================================================================
  // AUTHORIZATION
  // =========================================================================
  describe('Authorization', () => {
    it('should return 403 for unauthenticated requests', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/loans/penalties/configurations',
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(403);
    });

    it('should allow support role for read operations', async () => {
      mockExecute.mockResolvedValueOnce({
        data: [{ id: 'pen_001' }],
        error: null,
      });

      const event = createAuthEvent({
        httpMethod: 'GET',
        path: '/loans/loan_001/penalties',
        roles: 'support',
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
    });

    it('should deny support role for write operations', async () => {
      const event = createAuthEvent({
        httpMethod: 'POST',
        path: '/loans/penalties/configurations',
        body: JSON.stringify({
          penalty_type: 'late_fee',
          name: 'Test',
          calculation_method: 'flat',
          flat_amount_usd: 2.00,
          grace_period_days: 3,
          min_days_past_due: 1,
          recurrence: 'once',
          is_active: true,
          effective_from: '2026-01-01',
        }),
        roles: 'support',
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // UNKNOWN ROUTES
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown path', async () => {
      const event = createAuthEvent({
        httpMethod: 'GET',
        path: '/loans/unknown/endpoint',
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(404);
    });
  });
});
