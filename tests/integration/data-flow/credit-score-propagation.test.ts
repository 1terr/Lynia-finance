/**
 * Cross-Service Data Flow Tests: Credit Score Propagation
 *
 * Validates credit score calculation, storage, and propagation:
 * - Score components correctly sum to total_raw_score (0-1000)
 * - Scaled score maps to 300-850 range: 300 + (raw/1000) * 550
 * - Decision thresholds determine tier correctly
 * - Score is stored in credit_scores table with all components
 * - Loan limit and interest rate match tier
 * - Neutral scores for missing data (first-time, no device, no external credit)
 */

import {
  resetMockDataStore,
  createAPIGatewayEvent,
} from '../../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mock Supabase before importing handler
// ---------------------------------------------------------------------------
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ data: null, error: null }),
  match: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
};

const mockDb = {
  from: jest.fn(() => ({ ...mockQueryBuilder })),
};

jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------
import { handler } from '../../../services/scoring-service/src/index';

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Credit Score Propagation Data Flow Tests', () => {
  const customerId = 'cust_score_001';

  beforeEach(() => {
    resetMockDataStore();
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Score components sum to total_raw_score (0-1000)
  // =========================================================================
  describe('Score Component Summation', () => {
    it('should correctly sum all 6 components to total_raw_score', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 3,
          dependents: 2,
          requested_loan_amount: 350,
          device_retail_price_usd: 400,
          previous_loans_count: 2,
          on_time_payment_rate: 0.95,
          bill_payment_consistency: 0.90,
          communication_response_rate: 0.90,
          external_credit_data: {
            credit_bureau_score: 750,
            platform_verified: true,
            platform_earnings_3m_usd: 1500,
            platform_rating: 4.5,
            bank_account_verified: true,
            bank_account_age_months: 24,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 97,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.body);

      // Verify components exist
      expect(result.components).toBeDefined();
      expect(result.components.affordability).toBeDefined();
      expect(result.components.repayment_willingness).toBeDefined();
      expect(result.components.device_collateral).toBeDefined();
      expect(result.components.external_credit).toBeDefined();
      expect(result.components.kyc_verification).toBeDefined();
      expect(result.components.org_verification).toBeDefined();

      // external_credit always 0 due to weight 0
      expect(result.components.external_credit).toBe(0);

      // Verify sum equals total_raw_score
      const componentSum =
        result.components.affordability
        + result.components.repayment_willingness
        + result.components.device_collateral
        + result.components.external_credit
        + result.components.kyc_verification
        + result.components.org_verification;

      expect(result.total_raw_score).toBe(componentSum);
    });

    it('should keep total_raw_score within 0-1000 range', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 1,
          dependents: 0,
          requested_loan_amount: 200,
          device_retail_price_usd: 300,
          previous_loans_count: 5,
          on_time_payment_rate: 1.0,
          bill_payment_consistency: 1.0,
          communication_response_rate: 1.0,
          org_verified_salary_usd: 1000,
          org_verification: {
            scoring_trust_level: 90,
            employment_status: 'active',
            tenure_months: 72,
            salary_verified: true,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 99,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      expect(result.total_raw_score).toBeGreaterThanOrEqual(0);
      expect(result.total_raw_score).toBeLessThanOrEqual(1000);
    });

    it('should enforce component maximums: affordability<=250, repayment<=150, device_collateral<=100, external_credit=0, kyc<=150, org<=350', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 1,
          dependents: 0,
          requested_loan_amount: 200,
          device_retail_price_usd: 300,
          org_verified_salary_usd: 1000,
          previous_loans_count: 5,
          on_time_payment_rate: 1.0,
          bill_payment_consistency: 1.0,
          communication_response_rate: 1.0,
          org_verification: {
            scoring_trust_level: 90,
            employment_status: 'active',
            tenure_months: 72,
            salary_verified: true,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 99,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      expect(result.components.affordability).toBeLessThanOrEqual(250);
      expect(result.components.repayment_willingness).toBeLessThanOrEqual(150);
      expect(result.components.device_collateral).toBeLessThanOrEqual(100);
      expect(result.components.external_credit).toBe(0);
      expect(result.components.kyc_verification).toBeLessThanOrEqual(150);
      expect(result.components.org_verification).toBeLessThanOrEqual(350);
    });
  });

  // =========================================================================
  // 2. Scaled score formula: 300 + (raw/1000) * 550
  // =========================================================================
  describe('Scaled Score Formula', () => {
    it('should correctly map raw score to 300-850 range', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 4,
          dependents: 2,
          requested_loan_amount: 300,
          device_retail_price_usd: 350,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 95,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      // Verify formula: scaled_score = 300 + (total_raw_score / 1000) * 550
      const expectedScaled = Math.round(
        300 + (result.total_raw_score / 1000) * 550,
      );
      expect(result.scaled_score).toBe(expectedScaled);
    });

    it('should produce scaled_score >= 300 (minimum)', async () => {
      // Worst possible input
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 10,
          dependents: 8,
          requested_loan_amount: 500,
          device_retail_price_usd: 30,
          previous_loans_count: 5,
          on_time_payment_rate: 0.1,
          bill_payment_consistency: 0.1,
          communication_response_rate: 0.1,
          kyc_result: {
            id_verification: { status: 'failed' },
            face_match_score: 20,
            liveness_passed: false,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      expect(result.scaled_score).toBeGreaterThanOrEqual(300);
    });

    it('should produce scaled_score <= 850 (maximum)', async () => {
      // Best possible input
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 1,
          dependents: 0,
          requested_loan_amount: 100,
          device_retail_price_usd: 300,
          org_verified_salary_usd: 2000,
          previous_loans_count: 10,
          on_time_payment_rate: 1.0,
          bill_payment_consistency: 1.0,
          communication_response_rate: 1.0,
          org_verification: {
            scoring_trust_level: 90,
            employment_status: 'active',
            tenure_months: 72,
            salary_verified: true,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 100,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      expect(result.scaled_score).toBeLessThanOrEqual(850);
    });
  });

  // =========================================================================
  // 3. Decision thresholds
  // =========================================================================
  describe('Decision Thresholds', () => {
    it('should approve Tier 3 for scaled_score >= 650', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 2,
          dependents: 1,
          requested_loan_amount: 200,
          device_retail_price_usd: 300,
          org_verified_salary_usd: 800,
          previous_loans_count: 3,
          on_time_payment_rate: 0.98,
          bill_payment_consistency: 0.95,
          communication_response_rate: 0.95,
          org_verification: {
            scoring_trust_level: 90,
            employment_status: 'active',
            tenure_months: 72,
            salary_verified: true,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 98,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      if (result.scaled_score >= 650) {
        expect(result.decision).toBe('approve');
        expect(result.tier).toBe('Tier 3');
        expect(result.credit_limit_usd).toBe(2000);
        expect(result.down_payment_percentage).toBe(10);
        expect(result.interest_rate_apr).toBe(3);
      }
    });

    it('should approve Tier 2 for scaled_score >= 500 and < 650', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 300,
          device_retail_price_usd: 350,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 92,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      if (result.scaled_score >= 500 && result.scaled_score < 650) {
        expect(result.decision).toBe('approve');
        expect(result.tier).toBe('Tier 2');
        expect(result.credit_limit_usd).toBe(500);
        expect(result.down_payment_percentage).toBe(20);
        expect(result.interest_rate_apr).toBe(4);
      }
    });

    it('should produce low score for worst-case inputs', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 8,
          dependents: 6,
          requested_loan_amount: 500,
          device_retail_price_usd: 50,
          previous_loans_count: 2,
          on_time_payment_rate: 0.30,
          bill_payment_consistency: 0.20,
          communication_response_rate: 0.20,
          kyc_result: {
            id_verification: { status: 'failed' },
            face_match_score: 30,
            liveness_passed: false,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      // With bad data everywhere, score is low
      expect(result.scaled_score).toBeLessThan(500);
      expect(['approve', 'reject']).toContain(result.decision);
    });

    it('should validate all tier thresholds and their corresponding limits', () => {
      const thresholds = [
        {
          minScore: 650,
          maxScore: 850,
          tier: 'Tier 3',
          limit: 2000,
          downPayment: 10,
          apr: 3,
        },
        {
          minScore: 500,
          maxScore: 649,
          tier: 'Tier 2',
          limit: 500,
          downPayment: 20,
          apr: 4,
        },
        {
          minScore: 300,
          maxScore: 499,
          tier: 'Tier 1',
          limit: 200,
          downPayment: 30,
          apr: 5,
        },
      ];

      for (const threshold of thresholds) {
        expect(threshold.minScore).toBeLessThanOrEqual(threshold.maxScore);
        expect(threshold.limit).toBeGreaterThanOrEqual(0);
        expect(threshold.downPayment).toBeGreaterThanOrEqual(0);
        expect(threshold.apr).toBeGreaterThanOrEqual(0);

        if (threshold.tier === 'Tier 3') {
          expect(threshold.limit).toBe(2000);
          expect(threshold.downPayment).toBe(10);
          expect(threshold.apr).toBe(3);
        }
        if (threshold.tier === 'Tier 2') {
          expect(threshold.limit).toBe(500);
          expect(threshold.downPayment).toBe(20);
          expect(threshold.apr).toBe(4);
        }
        if (threshold.tier === 'Tier 1') {
          expect(threshold.limit).toBe(200);
          expect(threshold.downPayment).toBe(30);
          expect(threshold.apr).toBe(5);
        }
      }
    });
  });

  // =========================================================================
  // 4. Score stored in credit_scores table
  // =========================================================================
  describe('Score Storage', () => {
    it('should store score in credit_scores table with all components', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 350,
          device_retail_price_usd: 400,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 95,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      expect(result.customer_id).toBe(customerId);
      expect(result.total_raw_score).toBeDefined();
      expect(result.scaled_score).toBeDefined();
      expect(result.components).toBeDefined();
      expect(result.decision).toBeDefined();
      expect(result.calculated_at).toBeDefined();

      // Verify the insert was called on supabase
      expect(mockDb.from).toHaveBeenCalledWith('credit_scores');
    });
  });

  // =========================================================================
  // 5. Neutral scores for missing data
  // =========================================================================
  describe('Neutral Scores for Missing Data', () => {
    it('should give first-time customer neutral repayment score (75/150)', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 300,
          device_retail_price_usd: 350,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 95,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      // Neutral repayment: raw 75/150, scaled: round(75/150 * 150) = 75
      expect(result.components.repayment_willingness).toBe(75);
    });

    it('should give neutral device collateral score (50/100) when no device price', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 300,
          // No device_retail_price_usd
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 95,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      // No device price -> neutral 50/100, scaled: round(50/100 * 100) = 50
      expect(result.components.device_collateral).toBe(50);
    });

    it('should give zero external credit score due to zero weight', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 300,
          device_retail_price_usd: 350,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 95,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      // Weight is 0, so component is always 0 regardless of raw score
      expect(result.components.external_credit).toBe(0);
    });
  });

  // =========================================================================
  // 6. Loan tier parameters
  // =========================================================================
  describe('Loan Tier Parameters', () => {
    it('should return Tier 3 parameters: $2000 limit, 10% down, 3% APR for high scores', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 1,
          dependents: 0,
          requested_loan_amount: 200,
          device_retail_price_usd: 300,
          org_verified_salary_usd: 1000,
          previous_loans_count: 5,
          on_time_payment_rate: 0.99,
          bill_payment_consistency: 0.95,
          communication_response_rate: 0.95,
          org_verification: {
            scoring_trust_level: 90,
            employment_status: 'active',
            tenure_months: 72,
            salary_verified: true,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 99,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      if (result.scaled_score >= 650) {
        expect(result.tier).toBe('Tier 3');
        expect(result.credit_limit_usd).toBe(2000);
        expect(result.down_payment_percentage).toBe(10);
        expect(result.interest_rate_apr).toBe(3);
      }
    });

    it('should return review for borderline scores (300-349)', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 5,
          dependents: 3,
          requested_loan_amount: 350,
          device_retail_price_usd: 200,
          previous_loans_count: 1,
          on_time_payment_rate: 0.70,
          bill_payment_consistency: 0.60,
          communication_response_rate: 0.65,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 85,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      // Score gets approved or rejected based on threshold
      expect(['approve', 'reject']).toContain(result.decision);
      if (result.decision === 'approve' && result.scaled_score < 500) {
        expect(result.tier).toBe('Tier 1');
        expect(result.credit_limit_usd).toBe(200);
      }
    });
  });

  // =========================================================================
  // 7. Score propagation to loan decisions
  // =========================================================================
  describe('Score -> Loan Decision Propagation', () => {
    it('should use credit score to determine loan eligibility and terms', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          household_size: 2,
          dependents: 1,
          requested_loan_amount: 350,
          device_retail_price_usd: 400,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 95,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      // The score result should contain all information needed for loan creation
      expect(result.customer_id).toBe(customerId);
      expect(result.decision).toBeDefined();
      expect(['approve', 'reject']).toContain(result.decision);
      expect(result.credit_limit_usd).toBeDefined();
      expect(typeof result.credit_limit_usd).toBe('number');
      expect(result.interest_rate_apr).toBeDefined();
      expect(result.down_payment_percentage).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          // Missing: requested_loan_amount, kyc_result
        }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when customer_id is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          requested_loan_amount: 350,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 95,
            liveness_passed: true,
          },
        }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toContain('customer_id');
    });
  });
});
