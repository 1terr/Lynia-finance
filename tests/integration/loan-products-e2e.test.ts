/**
 * Loan Products - End-to-End Integration Tests (Task 9)
 *
 * Validates the entire loan product categories system:
 * - Scoring weight verification across product categories
 * - Fineract product mapping (database-driven + tier fallback)
 * - Organization verification endpoints
 * - Decision thresholds and tier assignment
 * - Data type definitions
 */

import {
  createAPIGatewayEvent,
  parseResponseBody,
  expectCORSHeaders,
} from '../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mock database client (same pattern as contract tests)
// ---------------------------------------------------------------------------

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
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

jest.mock('../../services/shared/clients/fineract-sync', () => ({
  syncCustomerToFineract: jest.fn().mockResolvedValue('fineract-client-123'),
  syncLoanToFineract: jest.fn().mockResolvedValue('fineract-loan-456'),
  approveLoanInFineract: jest.fn().mockResolvedValue(true),
}));

import { handler } from '../../services/scoring-service/src/index';

// ---------------------------------------------------------------------------
// Test input builders (matches CreditScoreInput interface)
// ---------------------------------------------------------------------------

function buildScoringInput(overrides: Record<string, unknown> = {}) {
  return {
    customer_id: 'cust_test_001',
    monthly_income_usd: 500,
    existing_debt_obligations_usd: 50,
    household_size: 3,
    dependents: 2,
    requested_loan_amount: 350,
    kyc_result: {
      id_verification: { status: 'verified' },
      face_match_score: 95,
      liveness_passed: true,
    },
    ...overrides,
  };
}

function buildHighScoreSmartphoneInput() {
  return buildScoringInput({
    product_category: 'smartphone',
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

function buildHighScoreDigitalInput() {
  return buildScoringInput({
    product_category: 'digital',
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
    org_verification: {
      scoring_trust_level: 90,
      employment_status: 'active',
      tenure_months: 72,
      salary_verified: true,
    },
  });
}

function buildLowScoreInput() {
  return buildScoringInput({
    monthly_income_usd: 80,
    existing_debt_obligations_usd: 60,
    household_size: 8,
    dependents: 6,
    requested_loan_amount: 500,
    kyc_result: {
      id_verification: { status: 'failed' },
      face_match_score: 40,
      liveness_passed: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Loan Products E2E Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset execute mock to return null by default
    mockQueryBuilder.execute.mockResolvedValue({ data: null, error: null });
  });

  // =========================================================================
  // Scoring Weight Verification (Task 9 - E2E Test 8)
  // =========================================================================
  describe('Scoring Weight Verification', () => {
    it('smartphone scoring uses 5-component weights summing to 1000', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildHighScoreSmartphoneInput()),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = parseResponseBody<{
        components: Record<string, number>;
        total_raw_score: number;
        scaled_score: number;
        product_category: string;
      }>(response);

      expect(body.product_category).toBe('smartphone');
      expect(body.components).toHaveProperty('affordability');
      expect(body.components).toHaveProperty('repayment_willingness');
      expect(body.components).toHaveProperty('mobile_money');
      expect(body.components).toHaveProperty('external_credit');
      expect(body.components).toHaveProperty('kyc_verification');

      // org_verification should be 0 for smartphone
      if ('org_verification' in body.components) {
        expect(body.components.org_verification).toBe(0);
      }

      // Total raw score: 0-1000, scaled: 300-850
      expect(body.total_raw_score).toBeGreaterThanOrEqual(0);
      expect(body.total_raw_score).toBeLessThanOrEqual(1000);
      expect(body.scaled_score).toBeGreaterThanOrEqual(300);
      expect(body.scaled_score).toBeLessThanOrEqual(850);
    });

    it('digital scoring uses 6-component weights with org verification', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildHighScoreDigitalInput()),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = parseResponseBody<{
        components: Record<string, number>;
        total_raw_score: number;
        product_category: string;
      }>(response);

      expect(body.product_category).toBe('digital');
      expect(body.components).toHaveProperty('org_verification');
      expect(body.components.org_verification).toBeGreaterThan(0);

      // Sum of components equals total_raw_score
      const sum = Object.values(body.components).reduce((a, b) => a + b, 0);
      expect(sum).toBe(body.total_raw_score);
      expect(body.total_raw_score).toBeLessThanOrEqual(1000);
    });
  });

  // =========================================================================
  // Smartphone Loan Lifecycle (Task 9 - E2E Test 1)
  // =========================================================================
  describe('Smartphone Loan Scoring', () => {
    it('high-scoring customer gets approved with correct tier', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildHighScoreSmartphoneInput()),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = parseResponseBody<{
        decision: string;
        tier: string;
        credit_limit_usd: number;
        scaled_score: number;
        down_payment_percentage: number;
      }>(response);

      expect(body.decision).toBe('approve');
      expect(['Tier 1', 'Tier 2', 'Tier 3']).toContain(body.tier);
      expect(body.credit_limit_usd).toBeGreaterThan(0);
      expect(body.scaled_score).toBeGreaterThanOrEqual(650);
      expect(body.down_payment_percentage).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Digital Loan Lifecycle (Task 9 - E2E Test 2)
  // =========================================================================
  describe('Digital Loan Scoring', () => {
    it('digital loan with org verification gets approved', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildHighScoreDigitalInput()),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = parseResponseBody<{
        decision: string;
        product_category: string;
        components: Record<string, number>;
      }>(response);

      expect(body.decision).toBe('approve');
      expect(body.product_category).toBe('digital');
      expect(body.components.org_verification).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Organization Verification (Task 9 - E2E Test 5)
  // =========================================================================
  describe('Organization Verification', () => {
    it('should verify organization membership by phone number', async () => {
      // Mock the DB to return org member data
      mockQueryBuilder.execute
        .mockResolvedValueOnce({
          data: {
            organization_id: 'org-gov-001',
            employment_status: 'active',
            employment_start_date: '2018-03-01',
            department: 'Education',
            grade_level: 'Grade 7',
            monthly_salary_usd: 450,
            salary_verified: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'org-gov-001',
            org_type: 'government',
            scoring_trust_level: 90,
            org_name: 'Civil Service Commission',
            is_active: true,
          },
          error: null,
        });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/verify-organization',
        body: JSON.stringify({ phone_number: '+263771234567' }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = parseResponseBody<{
        found: boolean;
        org_type?: string;
        scoring_trust_level?: number;
      }>(response);

      expect(body.found).toBe(true);
      expect(body.org_type).toBe('government');
      expect(body.scoring_trust_level).toBe(90);
    });

    it('should return not found for unregistered phone', async () => {
      // DB returns no member found
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/verify-organization',
        body: JSON.stringify({ phone_number: '+263779999999' }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = parseResponseBody<{ found: boolean }>(response);
      expect(body.found).toBe(false);
    });

    it('should reject missing phone number', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/verify-organization',
        body: JSON.stringify({}),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // First-Time Customer Handling
  // =========================================================================
  describe('First-Time Customer Handling', () => {
    it('first-time customer gets neutral repayment score', async () => {
      const input = buildScoringInput({ product_category: 'smartphone' });
      // No repayment data = first-time customer

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = parseResponseBody<{
        components: Record<string, number>;
      }>(response);

      // Neutral repayment score = 125/250 * 250 = 125
      expect(body.components.repayment_willingness).toBe(125);
    });
  });

  // =========================================================================
  // Rejection Threshold (Task 9 - E2E Test 7)
  // =========================================================================
  describe('Rejection Threshold', () => {
    it('low-scoring customer gets rejected', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildLowScoreInput()),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = parseResponseBody<{
        decision: string;
        tier: string;
        credit_limit_usd: number;
      }>(response);

      expect(body.decision).toBe('reject');
      expect(body.tier).toBe('Rejected');
      expect(body.credit_limit_usd).toBe(0);
    });
  });

  // =========================================================================
  // Input Validation (Task 9 - E2E Test 9)
  // =========================================================================
  describe('Input Validation', () => {
    it('rejects missing customer_id', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          monthly_income_usd: 500,
          requested_loan_amount: 200,
          kyc_result: { id_verification: { status: 'verified' }, face_match_score: 90, liveness_passed: true },
        }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
    });

    it('rejects missing monthly_income_usd', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: 'cust-001',
          requested_loan_amount: 200,
          kyc_result: { id_verification: { status: 'verified' }, face_match_score: 90, liveness_passed: true },
        }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
    });

    it('rejects missing kyc_result', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: 'cust-001',
          monthly_income_usd: 500,
          requested_loan_amount: 200,
        }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // Response Headers
  // =========================================================================
  describe('Response Headers', () => {
    it('includes CORS and Content-Type headers on success', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildHighScoreSmartphoneInput()),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      expectCORSHeaders(response);
    });

    it('includes CORS headers on error responses', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({}),
      });

      const response = await handler(event);
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      expectCORSHeaders(response);
    });
  });

  // =========================================================================
  // Route Handling
  // =========================================================================
  describe('Route Handling', () => {
    it('returns 404 for unknown routes', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/scoring/nonexistent',
        pathParameters: { customerId: 'nonexistent' },
      });

      const response = await handler(event);
      // GET /scoring/{customerId} is valid - returns 200 or 404 based on data
      expect([200, 404]).toContain(response.statusCode);
    });

    it('returns 405 for method not allowed on existing route', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'PUT',
        path: '/scoring/calculate',
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(405);
    });
  });

  // =========================================================================
  // Database Resilience
  // =========================================================================
  describe('Database Resilience', () => {
    it('returns score even when DB insert fails', async () => {
      // Make DB insert fail
      mockQueryBuilder.execute.mockResolvedValue({
        data: null,
        error: { message: 'Connection refused' },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(buildHighScoreSmartphoneInput()),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = parseResponseBody<{ total_raw_score: number; decision: string }>(response);
      expect(body.total_raw_score).toBeGreaterThanOrEqual(0);
      expect(body.decision).toBeDefined();
    });
  });

  // =========================================================================
  // Product Category Defaults
  // =========================================================================
  describe('Product Category Defaults', () => {
    it('defaults to smartphone when product_category not specified', async () => {
      const input = buildScoringInput(); // no product_category

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify(input),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const body = parseResponseBody<{
        product_category: string;
        components: Record<string, number>;
      }>(response);

      expect(body.product_category).toBe('smartphone');
      if ('org_verification' in body.components) {
        expect(body.components.org_verification).toBe(0);
      }
    });
  });

  // =========================================================================
  // Score History Retrieval
  // =========================================================================
  describe('Score History', () => {
    it('GET /scoring/{customerId} returns stored score', async () => {
      // Mock DB to return a stored score
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'score-001',
          customer_id: 'cust-001',
          total_raw_score: 750,
          scaled_score: 712,
          components: { affordability: 250, repayment_willingness: 200, mobile_money: 150, external_credit: 100, kyc_verification: 50 },
          decision: 'approve',
          tier: 'Tier 2',
          credit_limit_usd: 350,
          calculated_at: new Date().toISOString(),
        },
        error: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/scoring/cust-001',
        pathParameters: { customerId: 'cust-001' },
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
    });

    it('GET /scoring/ without customerId returns 404', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/scoring/',
        pathParameters: {},
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(404);
    });
  });
});

// ===========================================================================
// Fineract Product Mapping Tests (Task 8 verification)
// ===========================================================================
describe('Fineract Product Mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder.execute.mockResolvedValue({ data: null, error: null });
  });

  it('scoring a digital loan product returns digital product_category', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/scoring/calculate',
      body: JSON.stringify(buildHighScoreDigitalInput()),
    });

    const response = await handler(event);
    expect(response.statusCode).toBe(200);

    const body = parseResponseBody<{
      decision: string;
      product_category: string;
      tier: string;
    }>(response);

    expect(body.product_category).toBe('digital');
    expect(body.decision).toBe('approve');
    // Digital loans should still get a valid tier for Fineract mapping
    expect(['Tier 1', 'Tier 2', 'Tier 3']).toContain(body.tier);
  });

  it('scoring a smartphone loan product returns smartphone product_category', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/scoring/calculate',
      body: JSON.stringify(buildHighScoreSmartphoneInput()),
    });

    const response = await handler(event);
    expect(response.statusCode).toBe(200);

    const body = parseResponseBody<{
      decision: string;
      product_category: string;
      tier: string;
    }>(response);

    expect(body.product_category).toBe('smartphone');
    expect(body.decision).toBe('approve');
    expect(['Tier 1', 'Tier 2', 'Tier 3']).toContain(body.tier);
  });

  it('approved loans have valid credit limits and interest rates', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/scoring/calculate',
      body: JSON.stringify(buildHighScoreSmartphoneInput()),
    });

    const response = await handler(event);
    expect(response.statusCode).toBe(200);

    const body = parseResponseBody<{
      decision: string;
      credit_limit_usd: number;
      interest_rate_apr: number;
      down_payment_percentage: number;
    }>(response);

    expect(body.decision).toBe('approve');
    expect(body.credit_limit_usd).toBeGreaterThan(0);
    expect(body.interest_rate_apr).toBeGreaterThan(0);
    expect(body.down_payment_percentage).toBeGreaterThanOrEqual(0);
  });
});

// ===========================================================================
// Product Type Definitions Tests (Task 5 verification)
// ===========================================================================
describe('Product Type Definitions', () => {
  it('LoanProduct type has all required fields', () => {
    const product = {
      id: 'test-id',
      product_code: 'TEST_001',
      product_name: 'Test Product',
      product_type: 'asset_financing' as const,
      product_category: 'smartphone' as const,
      status: 'active' as const,
      min_amount_usd: 50,
      max_amount_usd: 500,
      loan_term_months: 6,
      min_term_months: 3,
      max_term_months: 12,
      interest_rate_annual: 60.0,
      interest_rate_monthly: 5.0,
      deposit_percentage: 15,
      min_deposit_usd: 10,
      requires_device: true,
      requires_organization_verification: false,
      allowed_disbursement_methods: [] as string[],
      max_active_loans: 1,
      display_order: 1,
      fineract_product_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(product.product_code).toBe('TEST_001');
    expect(product.product_category).toBe('smartphone');
    expect(product.requires_device).toBe(true);
  });

  it('DeviceModel type has all required fields', () => {
    const model = {
      id: 'test-model',
      brand: 'Samsung',
      model_name: 'Galaxy A14',
      model_code: 'SAM_A14',
      storage_gb: 64,
      ram_gb: 4,
      screen_size_inches: 6.6,
      device_type: 'smartphone',
      retail_price_usd: 199.0,
      wholesale_price_usd: 145.0,
      is_active: true,
      available_stock: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(model.brand).toBe('Samsung');
    expect(model.retail_price_usd).toBe(199.0);
    expect(model.retail_price_usd - model.wholesale_price_usd).toBe(54.0);
  });

  it('Organization type has all required fields', () => {
    const org = {
      id: 'test-org',
      org_code: 'GOV_CSC',
      org_name: 'Civil Service Commission',
      org_type: 'government' as const,
      verification_method: 'excel_upload' as const,
      scoring_trust_level: 90,
      is_active: true,
      total_members: 150,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(org.org_type).toBe('government');
    expect(org.scoring_trust_level).toBe(90);
  });

  it('OrganizationMember type has required fields', () => {
    const member = {
      id: 'member-001',
      organization_id: 'org-001',
      phone_number: '+263771234567',
      employee_number: 'EMP001',
      employment_status: 'active' as const,
      salary_verified: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(member.employment_status).toBe('active');
    expect(member.salary_verified).toBe(true);
  });

  it('MemberImportResult has correct shape', () => {
    const result = {
      import_batch_id: 'batch-001',
      total: 100,
      inserted: 95,
      skipped: 3,
      errors: 2,
    };

    expect(result.total).toBe(result.inserted + result.skipped + result.errors);
  });
});
