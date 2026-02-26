/**
 * Scoring Service - API Contract Tests
 *
 * Validates that all scoring service endpoints conform to
 * their API contracts: request validation, response shapes,
 * decision thresholds, and error handling.
 */

import {
  createAPIGatewayEvent,
  parseResponseBody,
  expectSuccessResponse,
  expectErrorResponse,
  expectCORSHeaders,
} from '../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mocks - Supabase client is created at module level, so mock before import
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
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ data: null, error: null }),
};

const mockDb = {
  from: jest.fn(() => mockQueryBuilder),
};

jest.mock('../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

import { handler } from '../../services/scoring-service/src/index';

// ---------------------------------------------------------------------------
// Helpers - Scoring input builders
// ---------------------------------------------------------------------------

/** Build a minimal valid scoring request body */
function buildScoringInput(overrides: Record<string, unknown> = {}) {
  return {
    customer_id: 'cust_001',
    monthly_income_usd: 500,
    existing_debt_obligations_usd: 50,
    household_size: 3,
    dependents: 2,
    requested_loan_amount: 350,
    kyc_result: {
      id_verification: { status: 'verified' },
      face_match: { confidence: 0.95 },
      liveness: { status: 'passed' },
    },
    ...overrides,
  };
}

/** Build a scoring input tuned to produce a high score (Tier 3, approve) */
function buildHighScoreInput() {
  return buildScoringInput({
    monthly_income_usd: 800,
    existing_debt_obligations_usd: 0,
    household_size: 1,
    dependents: 0,
    requested_loan_amount: 200,
    previous_loans_count: 5,
    on_time_payment_rate: 0.98,
    bill_payment_consistency: 0.95,
    communication_response_rate: 0.95,
    mobile_money_profile: {
      account_age_months: 36,
      avg_monthly_inflow_usd: 600,
      avg_monthly_outflow_usd: 400,
      transaction_count_3m: 120,
      balance_usd: 150,
      airtime_purchases_3m: 15,
      airtime_avg_per_purchase_usd: 5,
    },
    external_credit_data: {
      credit_bureau_score: 780,
      platform_verified: true,
      platform_earnings_3m_usd: 2000,
      platform_rating: 4.8,
      bank_account_verified: true,
      bank_account_age_months: 36,
    },
  });
}

/** Build a scoring input tuned to produce a low score (reject) */
function buildLowScoreInput() {
  return buildScoringInput({
    monthly_income_usd: 80,
    existing_debt_obligations_usd: 60,
    household_size: 8,
    dependents: 7,
    requested_loan_amount: 500,
    previous_loans_count: 3,
    on_time_payment_rate: 0.3,
    bill_payment_consistency: 0.2,
    communication_response_rate: 0.1,
    mobile_money_profile: {
      account_age_months: 2,
      avg_monthly_inflow_usd: 30,
      avg_monthly_outflow_usd: 25,
      transaction_count_3m: 5,
      balance_usd: 2,
      airtime_purchases_3m: 1,
      airtime_avg_per_purchase_usd: 1,
    },
    external_credit_data: {
      credit_bureau_score: 400,
      platform_verified: false,
      platform_earnings_3m_usd: 0,
      platform_rating: 0,
      bank_account_verified: false,
      bank_account_age_months: 0,
    },
    kyc_result: {
      id_verification: { status: 'review' },
      face_match: { confidence: 0.5 },
      liveness: { status: 'failed' },
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Scoring Service Contract Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: insert succeeds
    mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.execute.mockResolvedValue({ data: null, error: null });
  });

  // =========================================================================
  // POST /scoring/calculate
  // =========================================================================
  describe('POST /scoring/calculate', () => {
    it('should return 200 with full score result on valid input', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildScoringInput()),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('customer_id', 'cust_001');
      expect(body).toHaveProperty('product_category', 'smartphone');
      expect(body).toHaveProperty('total_raw_score');
      expect(body).toHaveProperty('scaled_score');
      expect(body).toHaveProperty('components');
      expect(body).toHaveProperty('decision');
      expect(body).toHaveProperty('credit_limit_usd');
      expect(body).toHaveProperty('tier');
      expect(body).toHaveProperty('down_payment_percentage');
      expect(body).toHaveProperty('interest_rate_apr');
      expect(body).toHaveProperty('calculated_at');
    });

    it('should return score components within their valid ranges', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildScoringInput()),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);
      const components = body.components as Record<string, number>;

      expect(components.affordability).toBeGreaterThanOrEqual(0);
      expect(components.affordability).toBeLessThanOrEqual(300);

      expect(components.repayment_willingness).toBeGreaterThanOrEqual(0);
      expect(components.repayment_willingness).toBeLessThanOrEqual(250);

      expect(components.mobile_money).toBeGreaterThanOrEqual(0);
      expect(components.mobile_money).toBeLessThanOrEqual(200);

      expect(components.external_credit).toBeGreaterThanOrEqual(0);
      expect(components.external_credit).toBeLessThanOrEqual(150);

      expect(components.kyc_verification).toBeGreaterThanOrEqual(0);
      expect(components.kyc_verification).toBeLessThanOrEqual(100);

      expect(components.org_verification).toBe(0); // 0 for smartphone loans
    });

    it('should return total_raw_score in range 0-1000', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildScoringInput()),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, number>>(response);

      expect(body.total_raw_score).toBeGreaterThanOrEqual(0);
      expect(body.total_raw_score).toBeLessThanOrEqual(1000);
    });

    it('should return scaled_score in range 300-850', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildScoringInput()),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, number>>(response);

      expect(body.scaled_score).toBeGreaterThanOrEqual(300);
      expect(body.scaled_score).toBeLessThanOrEqual(850);
    });

    it('should return decision as approve, review, or reject', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildScoringInput()),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, string>>(response);

      expect(['approve', 'review', 'reject']).toContain(body.decision);
    });

    // -----------------------------------------------------------------------
    // Decision threshold tests
    // -----------------------------------------------------------------------
    it('should approve with Tier 3 for scaled_score >= 750', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildHighScoreInput()),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);

      expect((body.scaled_score as number)).toBeGreaterThanOrEqual(750);
      expect(body.decision).toBe('approve');
      expect(body.tier).toBe('Tier 3');
      expect(body.credit_limit_usd).toBe(500);
      expect(body.down_payment_percentage).toBe(5);
      expect(body.interest_rate_apr).toBe(10);
    });

    it('should reject for scaled_score < 550', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildLowScoreInput()),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);

      expect((body.scaled_score as number)).toBeLessThan(550);
      expect(body.decision).toBe('reject');
      expect(body.tier).toBe('Rejected');
      expect(body.credit_limit_usd).toBe(0);
    });

    // -----------------------------------------------------------------------
    // First-time customer (no repayment history)
    // -----------------------------------------------------------------------
    it('should assign neutral repayment score for first-time customers', async () => {
      const input = buildScoringInput({
        previous_loans_count: undefined,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);
      const components = body.components as Record<string, number>;

      // Neutral score for first-time customers is 125
      expect(components.repayment_willingness).toBe(125);
    });

    // -----------------------------------------------------------------------
    // Validation error tests
    // -----------------------------------------------------------------------
    it('should return 400 when customer_id is missing', async () => {
      const input = buildScoringInput();
      delete (input as Record<string, unknown>).customer_id;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'customer_id is required');
    });

    it('should return 400 when monthly_income_usd is missing', async () => {
      const input = buildScoringInput();
      delete (input as Record<string, unknown>).monthly_income_usd;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect((body as Record<string, string>).error).toContain('monthly_income_usd');
    });

    it('should return 400 when requested_loan_amount is missing', async () => {
      const input = buildScoringInput();
      delete (input as Record<string, unknown>).requested_loan_amount;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect((body as Record<string, string>).error).toContain('requested_loan_amount');
    });

    it('should return 400 when kyc_result is missing', async () => {
      const input = buildScoringInput();
      delete (input as Record<string, unknown>).kyc_result;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect((body as Record<string, string>).error).toContain('kyc_result');
    });

    // -----------------------------------------------------------------------
    // Database storage resilience
    // -----------------------------------------------------------------------
    it('should still return score even when database insert fails', async () => {
      mockQueryBuilder.execute.mockResolvedValue({
        data: null,
        error: { code: 'PGRST001', message: 'insert failed' },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildScoringInput()),
      });

      const response = await handler(event);

      // Handler continues even on DB error
      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('customer_id');
      expect(body).toHaveProperty('scaled_score');
    });
  });

  // =========================================================================
  // GET /scoring/{customerId}
  // =========================================================================
  describe('GET /scoring/{customerId}', () => {
    it('should return 200 with stored score data', async () => {
      const storedScore = {
        customer_id: 'cust_001',
        total_raw_score: 720,
        scaled_score: 696,
        components: {
          affordability: 250,
          repayment_willingness: 200,
          mobile_money: 150,
          external_credit: 80,
          kyc_verification: 40,
        },
        decision: 'approve',
        credit_limit_usd: 200,
        tier: 'Tier 1',
        calculated_at: '2024-01-15T10:00:00Z',
      };

      mockQueryBuilder.execute.mockResolvedValue({ data: storedScore, error: null });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/scoring/cust_001',
        pathParameters: { customerId: 'cust_001' },
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toEqual(storedScore);
    });

    it('should return 404 when customerId path is "undefined"', async () => {
      // With the lambda-router, /scoring/undefined is a valid path that matches
      // GET /scoring/:customerId with customerId='undefined'. The handler treats
      // this as a non-existent customer (no DB row), returning 404.
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/scoring/undefined',
        pathParameters: { customerId: undefined as unknown as string },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 when no score found for customer', async () => {
      mockQueryBuilder.execute.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/scoring/cust_nonexistent',
        pathParameters: { customerId: 'cust_nonexistent' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Credit score not found for this customer');
    });

    it('should return 500 when database query throws', async () => {
      mockQueryBuilder.execute.mockRejectedValue(new Error('Connection lost'));

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/scoring/cust_001',
        pathParameters: { customerId: 'cust_001' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to fetch credit score');
    });
  });

  // =========================================================================
  // 404 - Unknown routes
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown paths', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/scoring',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Not Found');
    });

    it('should return 405 for POST to GET-only endpoint', async () => {
      // The lambda-router returns 405 (Method Not Allowed) when the path matches
      // an existing route but the method doesn't. /scoring/unknown matches
      // GET /scoring/:customerId, so POST returns 405.
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/unknown',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(405);
    });

    it('should include Content-Type and CORS headers on 404', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/nonexistent',
      });

      const response = await handler(event);

      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://lyniafinance.com');
    });
  });

  // =========================================================================
  // Top-level error handling
  // =========================================================================
  describe('Top-level error handling', () => {
    it('should return 500 when handler encounters an unexpected error', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: 'INVALID-JSON{{{',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });

  // =========================================================================
  // POST /scoring/verify-organization
  // =========================================================================
  describe('POST /scoring/verify-organization', () => {
    it('should return 400 when phone_number is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/verify-organization',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'phone_number is required');
    });

    it('should return found: false when member not found', async () => {
      mockQueryBuilder.execute.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'No rows' } });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/verify-organization',
        body: JSON.stringify({ phone_number: '+263770000000' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toEqual({ found: false });
    });

    it('should return found: true with org data when member exists', async () => {
      // First call: organization_members lookup
      // Second call: organizations lookup
      let callCount = 0;
      mockQueryBuilder.execute.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: {
              organization_id: 'org-uuid-123',
              employment_status: 'active',
              employment_start_date: '2018-03-01',
              salary_verified: true,
              monthly_salary_usd: 450.00,
              customer_id: 'cust-123',
            },
            error: null,
          });
        }
        return Promise.resolve({
          data: {
            id: 'org-uuid-123',
            org_name: 'Civil Service Commission',
            org_type: 'government',
            scoring_trust_level: 90,
          },
          error: null,
        });
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/verify-organization',
        body: JSON.stringify({ phone_number: '+263771234567' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody<Record<string, unknown>>(response);
      expect(body.found).toBe(true);
      expect(body.org_name).toBe('Civil Service Commission');
      expect(body.org_type).toBe('government');
      expect(body.scoring_trust_level).toBe(90);
      expect(body.employment_status).toBe('active');
      expect(body.salary_verified).toBe(true);
      expect(body.monthly_salary_usd).toBe(450.00);
      expect(typeof body.tenure_months).toBe('number');
    });

    it('should return found: false when org is inactive', async () => {
      let callCount = 0;
      mockQueryBuilder.execute.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: {
              organization_id: 'org-uuid-123',
              employment_status: 'active',
              employment_start_date: '2020-01-01',
              salary_verified: false,
              monthly_salary_usd: 0,
              customer_id: null,
            },
            error: null,
          });
        }
        // Org not found (inactive filtered out)
        return Promise.resolve({ data: null, error: null });
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/verify-organization',
        body: JSON.stringify({ phone_number: '+263771111111' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toEqual({ found: false });
    });

    it('should return 500 when database throws', async () => {
      mockQueryBuilder.execute.mockRejectedValue(new Error('Connection lost'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/verify-organization',
        body: JSON.stringify({ phone_number: '+263771234567' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to verify organization membership');
    });
  });

  // =========================================================================
  // Organization Verification Scoring (6-component digital loans)
  // =========================================================================
  describe('POST /scoring/calculate - Digital loan with org verification', () => {
    it('should score 200/200 for government employee with active status, 5+ years, verified salary', async () => {
      const input = buildScoringInput({
        product_category: 'digital',
        org_verification: {
          scoring_trust_level: 90,
          employment_status: 'active',
          tenure_months: 95,
          salary_verified: true,
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);
      const components = body.components as Record<string, number>;

      expect(body.product_category).toBe('digital');
      // Org verification raw: 80 (gov) + 50 (active) + 40 (5+ yrs) + 30 (verified) = 200/200
      // Scaled to weight 200: (200/200) * 200 = 200
      expect(components.org_verification).toBe(200);
    });

    it('should score 140/200 for corporate employee with active status, 2-5 years, unverified salary', async () => {
      const input = buildScoringInput({
        product_category: 'digital',
        org_verification: {
          scoring_trust_level: 70,
          employment_status: 'active',
          tenure_months: 36,
          salary_verified: false,
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);
      const components = body.components as Record<string, number>;

      // Org verification raw: 60 (corp) + 50 (active) + 30 (2-5yr) + 0 (not verified) = 140/200
      // Scaled to weight 200: (140/200) * 200 = 140
      expect(components.org_verification).toBe(140);
    });

    it('should score 175/200 for retired government employee with 5+ years and verified salary', async () => {
      const input = buildScoringInput({
        product_category: 'digital',
        org_verification: {
          scoring_trust_level: 90,
          employment_status: 'retired',
          tenure_months: 240,
          salary_verified: true,
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);
      const components = body.components as Record<string, number>;

      // 80 (gov) + 25 (retired) + 40 (5+ yrs) + 30 (verified) = 175/200
      // Scaled: (175/200) * 200 = 175
      expect(components.org_verification).toBe(175);
    });

    it('should score 170/200 for new government employee (<1 year) with verified salary', async () => {
      const input = buildScoringInput({
        product_category: 'digital',
        org_verification: {
          scoring_trust_level: 90,
          employment_status: 'active',
          tenure_months: 6,
          salary_verified: true,
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);
      const components = body.components as Record<string, number>;

      // 80 (gov) + 50 (active) + 10 (<1yr) + 30 (verified) = 170/200
      // Scaled: (170/200) * 200 = 170
      expect(components.org_verification).toBe(170);
    });

    it('should use 5-component model with org_verification=0 for smartphone loans', async () => {
      const input = buildScoringInput({
        product_category: 'smartphone',
        org_verification: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);
      const components = body.components as Record<string, number>;

      expect(body.product_category).toBe('smartphone');
      expect(components.org_verification).toBe(0);
    });

    it('should default to smartphone product_category when not specified', async () => {
      const input = buildScoringInput(); // no product_category

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);

      expect(body.product_category).toBe('smartphone');
    });

    it('should redistribute weights correctly for digital loans', async () => {
      const input = buildScoringInput({
        product_category: 'digital',
        org_verification: {
          scoring_trust_level: 90,
          employment_status: 'active',
          tenure_months: 95,
          salary_verified: true,
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);
      const components = body.components as Record<string, number>;

      // For digital loans:
      // mobile_money max = 100 (halved from 200)
      // external_credit max = 50 (reduced from 150)
      // org_verification max = 200 (new)
      expect(components.mobile_money).toBeLessThanOrEqual(100);
      expect(components.external_credit).toBeLessThanOrEqual(50);
      expect(components.org_verification).toBeLessThanOrEqual(200);

      // Total should still be in 0-1000 range
      const total = Object.values(components).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(1000);
    });

    it('should scale final score to 300-850 range for digital loans', async () => {
      const input = buildScoringInput({
        product_category: 'digital',
        org_verification: {
          scoring_trust_level: 90,
          employment_status: 'active',
          tenure_months: 95,
          salary_verified: true,
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, number>>(response);

      expect(body.scaled_score).toBeGreaterThanOrEqual(300);
      expect(body.scaled_score).toBeLessThanOrEqual(850);
    });

    it('should give org_verification=0 for digital loan with no org data', async () => {
      const input = buildScoringInput({
        product_category: 'digital',
        org_verification: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);
      const components = body.components as Record<string, number>;

      expect(components.org_verification).toBe(0);
    });

    it('should score 0 for employment_status=suspended', async () => {
      const input = buildScoringInput({
        product_category: 'digital',
        org_verification: {
          scoring_trust_level: 90,
          employment_status: 'suspended',
          tenure_months: 60,
          salary_verified: false,
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);
      const components = body.components as Record<string, number>;

      // 80 (gov) + 0 (suspended) + 40 (5+ yrs) + 0 (not verified) = 120/200
      // Scaled: (120/200) * 200 = 120
      expect(components.org_verification).toBe(120);
    });

    it('should score cooperative org type correctly (trust 40-59)', async () => {
      const input = buildScoringInput({
        product_category: 'digital',
        org_verification: {
          scoring_trust_level: 50,
          employment_status: 'active',
          tenure_months: 18,
          salary_verified: true,
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);
      const components = body.components as Record<string, number>;

      // 40 (coop) + 50 (active) + 20 (1-2yr) + 30 (verified) = 140/200
      // Scaled: (140/200) * 200 = 140
      expect(components.org_verification).toBe(140);
    });
  });
});
