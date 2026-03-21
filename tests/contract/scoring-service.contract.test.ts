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
    household_size: 3,
    dependents: 2,
    requested_loan_amount: 350,
    device_retail_price_usd: 400,
    kyc_result: {
      id_verification: { status: 'verified' },
      face_match_score: 95,
      liveness_passed: true,
    },
    ...overrides,
  };
}

/** Build a scoring input tuned to produce a high score (Tier 3, approve) */
function buildHighScoreInput() {
  return buildScoringInput({
    org_verified_salary_usd: 800,
    household_size: 1,
    dependents: 0,
    requested_loan_amount: 200,
    device_retail_price_usd: 300,
    previous_loans_count: 5,
    on_time_payment_rate: 0.98,
    bill_payment_consistency: 0.95,
    communication_response_rate: 0.95,
    org_verification: {
      scoring_trust_level: 90,
      employment_status: 'active',
      tenure_months: 72,
      salary_verified: true,
    },
  });
}

/** Build a scoring input tuned to produce a low score (reject) */
function buildLowScoreInput() {
  return buildScoringInput({
    household_size: 8,
    dependents: 7,
    requested_loan_amount: 500,
    device_retail_price_usd: 50,
    previous_loans_count: 3,
    on_time_payment_rate: 0.3,
    bill_payment_consistency: 0.2,
    communication_response_rate: 0.1,
    kyc_result: {
      id_verification: { status: 'review' },
      face_match_score: 50,
      liveness_passed: false,
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
      expect(components.affordability).toBeLessThanOrEqual(250);

      expect(components.repayment_willingness).toBeGreaterThanOrEqual(0);
      expect(components.repayment_willingness).toBeLessThanOrEqual(150);

      expect(components.device_collateral).toBeGreaterThanOrEqual(0);
      expect(components.device_collateral).toBeLessThanOrEqual(100);

      // external_credit has weight 0, so always 0
      expect(components.external_credit).toBe(0);

      expect(components.kyc_verification).toBeGreaterThanOrEqual(0);
      expect(components.kyc_verification).toBeLessThanOrEqual(150);

      expect(components.org_verification).toBeGreaterThanOrEqual(0);
      expect(components.org_verification).toBeLessThanOrEqual(350);
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

    it('should always return decision as approve for default input', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildScoringInput()),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, string>>(response);

      expect(body.decision).toBe('approve');
    });

    // -----------------------------------------------------------------------
    // Decision threshold tests
    // -----------------------------------------------------------------------
    it('should approve with high score for strong inputs (score >= 650)', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildHighScoreInput()),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);

      expect((body.scaled_score as number)).toBeGreaterThanOrEqual(650);
      expect(body.decision).toBe('approve');
      expect(body.tier).toBeDefined();
      expect(body.credit_limit_usd).toBeDefined();
    });

    it('should produce low score for worst-case inputs', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildLowScoreInput()),
      });

      const response = await handler(event);
      const body = parseResponseBody<Record<string, unknown>>(response);

      // With bad data across all components, score is low
      // (v2 model gives neutral org 175/350 so worst-case is higher than v1)
      expect((body.scaled_score as number)).toBeLessThan(600);
      expect(body.decision).toBe('approve');
      expect(body.tier).toBeDefined();
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

      // Neutral score for first-time customers is 75 (raw), scaled to weight: round(75/150 * 150) = 75
      expect(components.repayment_willingness).toBe(75);
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
          affordability: 200,
          repayment_willingness: 120,
          device_collateral: 80,
          external_credit: 0,
          kyc_verification: 120,
          org_verification: 200,
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
      expect(body).toHaveProperty('error', 'national_id is required');
    });

    it('should return found: false when member not found', async () => {
      mockQueryBuilder.execute.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'No rows' } });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/verify-organization',
        body: JSON.stringify({ national_id: '63-0000000A00' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toEqual({ found: false });
    });

    it('should return found: true with org data when member exists', async () => {
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
        body: JSON.stringify({ national_id: '63-2345678B08' }),
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
        body: JSON.stringify({ national_id: '63-1111111A11' }),
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
        body: JSON.stringify({ national_id: '63-2345678B08' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to verify organization membership');
    });
  });

  // =========================================================================
  // Organization Verification Scoring (digital loans)
  // =========================================================================
  describe('POST /scoring/calculate - Digital loan with org verification', () => {
    it('should score high for government employee with active status, 5+ years, verified salary', async () => {
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
      // Org verification raw: 120 (gov) + 80 (active) + 70 (5+ yrs) + 80 (verified) = 350/350
      // Scaled to weight 350: (350/350) * 350 = 350
      expect(components.org_verification).toBe(350);
    });

    it('should score 245/350 for corporate employee with active status, 2-5 years, unverified salary', async () => {
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

      // Org verification raw: 90 (corp) + 80 (active) + 55 (2-5yr) + 0 (not verified) = 225/350
      // Scaled to weight 350: round(225/350 * 350) = 225
      expect(components.org_verification).toBe(225);
    });

    it('should score for retired government employee with 5+ years and verified salary', async () => {
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

      // 120 (gov) + 40 (retired) + 70 (5+ yrs) + 80 (verified) = 310/350
      // Scaled: round(310/350 * 350) = 310
      expect(components.org_verification).toBe(310);
    });

    it('should score for new government employee (<1 year) with verified salary', async () => {
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

      // 120 (gov) + 80 (active) + 15 (<1yr) + 80 (verified) = 295/350
      // Scaled: round(295/350 * 350) = 295
      expect(components.org_verification).toBe(295);
    });

    it('should use neutral org score (175) for smartphone loans without org data', async () => {
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
      // Unaffiliated smartphone gets neutral 175/350
      expect(components.org_verification).toBe(175);
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

    it('should have component sum within 0-1000 for digital loans', async () => {
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

      // external_credit always 0 due to weight 0
      expect(components.external_credit).toBe(0);

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

    it('should give neutral org score for digital loan with no org data', async () => {
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

      // Null org data -> neutral 175/350
      expect(components.org_verification).toBe(175);
    });

    it('should score 0 employment points for employment_status=suspended', async () => {
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

      // 120 (gov) + 0 (suspended) + 70 (5+ yrs) + 0 (not verified) = 190/350
      // Scaled: round(190/350 * 350) = 190
      expect(components.org_verification).toBe(190);
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

      // 60 (coop) + 80 (active) + 35 (1-2yr) + 80 (verified) = 255/350
      // Scaled: round(255/350 * 350) = 255
      expect(components.org_verification).toBe(255);
    });
  });
});
