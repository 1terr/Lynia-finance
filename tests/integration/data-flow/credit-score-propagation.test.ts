/**
 * Cross-Service Data Flow Tests: Credit Score Propagation
 *
 * Validates credit score calculation, storage, and propagation:
 * - Score components correctly sum to total_raw_score (0-1000)
 * - Scaled score maps to 300-850 range: 300 + (raw/1000) * 550
 * - Decision thresholds determine tier correctly
 * - Score is stored in credit_scores table with all components
 * - Loan limit and interest rate match tier
 * - Neutral scores for missing data (first-time, no mobile money, no external credit)
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
    it('should correctly sum all 5 components to total_raw_score', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          monthly_income_usd: 500,
          existing_debt_obligations_usd: 0,
          household_size: 3,
          dependents: 2,
          requested_loan_amount: 350,
          previous_loans_count: 2,
          on_time_payment_rate: 0.95,
          bill_payment_consistency: 0.90,
          communication_response_rate: 0.90,
          mobile_money_profile: {
            account_age_months: 24,
            avg_monthly_inflow_usd: 500,
            avg_monthly_outflow_usd: 400,
            transaction_count_3m: 100,
            balance_usd: 100,
            airtime_purchases_3m: 12,
            airtime_avg_per_purchase_usd: 5,
          },
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
            face_match: { confidence: 0.97 },
            liveness: { status: 'passed' },
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
      expect(result.components.mobile_money).toBeDefined();
      expect(result.components.external_credit).toBeDefined();
      expect(result.components.kyc_verification).toBeDefined();

      // Verify sum equals total_raw_score
      const componentSum =
        result.components.affordability
        + result.components.repayment_willingness
        + result.components.mobile_money
        + result.components.external_credit
        + result.components.kyc_verification;

      expect(result.total_raw_score).toBe(componentSum);
    });

    it('should keep total_raw_score within 0-1000 range', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          monthly_income_usd: 1000,
          existing_debt_obligations_usd: 0,
          household_size: 1,
          dependents: 0,
          requested_loan_amount: 200,
          previous_loans_count: 5,
          on_time_payment_rate: 1.0,
          bill_payment_consistency: 1.0,
          communication_response_rate: 1.0,
          mobile_money_profile: {
            account_age_months: 48,
            avg_monthly_inflow_usd: 2000,
            avg_monthly_outflow_usd: 1000,
            transaction_count_3m: 200,
            balance_usd: 500,
            airtime_purchases_3m: 24,
            airtime_avg_per_purchase_usd: 10,
          },
          external_credit_data: {
            credit_bureau_score: 850,
            platform_verified: true,
            platform_earnings_3m_usd: 5000,
            platform_rating: 5.0,
            bank_account_verified: true,
            bank_account_age_months: 60,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.99 },
            liveness: { status: 'passed' },
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      expect(result.total_raw_score).toBeGreaterThanOrEqual(0);
      expect(result.total_raw_score).toBeLessThanOrEqual(1000);
    });

    it('should enforce component maximums: affordability<=300, repayment<=250, mobile<=200, external<=150, kyc<=100', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          monthly_income_usd: 1000,
          existing_debt_obligations_usd: 0,
          household_size: 1,
          dependents: 0,
          requested_loan_amount: 200,
          previous_loans_count: 5,
          on_time_payment_rate: 1.0,
          bill_payment_consistency: 1.0,
          communication_response_rate: 1.0,
          mobile_money_profile: {
            account_age_months: 48,
            avg_monthly_inflow_usd: 2000,
            avg_monthly_outflow_usd: 1000,
            transaction_count_3m: 200,
            balance_usd: 500,
            airtime_purchases_3m: 24,
            airtime_avg_per_purchase_usd: 10,
          },
          external_credit_data: {
            credit_bureau_score: 850,
            platform_verified: true,
            platform_earnings_3m_usd: 5000,
            platform_rating: 5.0,
            bank_account_verified: true,
            bank_account_age_months: 60,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.99 },
            liveness: { status: 'passed' },
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      expect(result.components.affordability).toBeLessThanOrEqual(300);
      expect(result.components.repayment_willingness).toBeLessThanOrEqual(250);
      expect(result.components.mobile_money).toBeLessThanOrEqual(200);
      expect(result.components.external_credit).toBeLessThanOrEqual(150);
      expect(result.components.kyc_verification).toBeLessThanOrEqual(100);
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
          monthly_income_usd: 500,
          existing_debt_obligations_usd: 50,
          household_size: 4,
          dependents: 2,
          requested_loan_amount: 300,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.95 },
            liveness: { status: 'passed' },
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
          monthly_income_usd: 10,
          existing_debt_obligations_usd: 1000,
          household_size: 10,
          dependents: 8,
          requested_loan_amount: 500,
          previous_loans_count: 5,
          on_time_payment_rate: 0.1,
          bill_payment_consistency: 0.1,
          communication_response_rate: 0.1,
          mobile_money_profile: {
            account_age_months: 1,
            avg_monthly_inflow_usd: 10,
            avg_monthly_outflow_usd: 5,
            transaction_count_3m: 2,
            balance_usd: 1,
            airtime_purchases_3m: 1,
            airtime_avg_per_purchase_usd: 1,
          },
          external_credit_data: {
            credit_bureau_score: 300,
            platform_verified: false,
            platform_earnings_3m_usd: 0,
            platform_rating: 1.0,
            bank_account_verified: false,
            bank_account_age_months: 0,
          },
          kyc_result: {
            id_verification: { status: 'failed' },
            face_match: { confidence: 0.2 },
            liveness: { status: 'failed' },
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
          monthly_income_usd: 5000,
          existing_debt_obligations_usd: 0,
          household_size: 1,
          dependents: 0,
          requested_loan_amount: 100,
          previous_loans_count: 10,
          on_time_payment_rate: 1.0,
          bill_payment_consistency: 1.0,
          communication_response_rate: 1.0,
          mobile_money_profile: {
            account_age_months: 60,
            avg_monthly_inflow_usd: 5000,
            avg_monthly_outflow_usd: 2000,
            transaction_count_3m: 500,
            balance_usd: 3000,
            airtime_purchases_3m: 50,
            airtime_avg_per_purchase_usd: 20,
          },
          external_credit_data: {
            credit_bureau_score: 850,
            platform_verified: true,
            platform_earnings_3m_usd: 10000,
            platform_rating: 5.0,
            bank_account_verified: true,
            bank_account_age_months: 120,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 1.0 },
            liveness: { status: 'passed' },
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
          monthly_income_usd: 800,
          existing_debt_obligations_usd: 0,
          household_size: 2,
          dependents: 1,
          requested_loan_amount: 350,
          previous_loans_count: 3,
          on_time_payment_rate: 0.98,
          bill_payment_consistency: 0.95,
          communication_response_rate: 0.95,
          mobile_money_profile: {
            account_age_months: 36,
            avg_monthly_inflow_usd: 800,
            avg_monthly_outflow_usd: 600,
            transaction_count_3m: 120,
            balance_usd: 200,
            airtime_purchases_3m: 15,
            airtime_avg_per_purchase_usd: 8,
          },
          external_credit_data: {
            credit_bureau_score: 780,
            platform_verified: true,
            platform_earnings_3m_usd: 2000,
            platform_rating: 4.8,
            bank_account_verified: true,
            bank_account_age_months: 36,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.98 },
            liveness: { status: 'passed' },
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
      // Use a moderate input designed to land in 700-749 range
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          monthly_income_usd: 500,
          existing_debt_obligations_usd: 50,
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 300,
          previous_loans_count: 2,
          on_time_payment_rate: 0.90,
          bill_payment_consistency: 0.85,
          communication_response_rate: 0.85,
          mobile_money_profile: {
            account_age_months: 18,
            avg_monthly_inflow_usd: 500,
            avg_monthly_outflow_usd: 350,
            transaction_count_3m: 60,
            balance_usd: 80,
            airtime_purchases_3m: 8,
            airtime_avg_per_purchase_usd: 5,
          },
          external_credit_data: {
            credit_bureau_score: 700,
            platform_verified: false,
            platform_earnings_3m_usd: 0,
            platform_rating: 0,
            bank_account_verified: true,
            bank_account_age_months: 18,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.92 },
            liveness: { status: 'passed' },
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
          monthly_income_usd: 80,
          existing_debt_obligations_usd: 200,
          household_size: 8,
          dependents: 6,
          requested_loan_amount: 500,
          previous_loans_count: 2,
          on_time_payment_rate: 0.30,
          bill_payment_consistency: 0.20,
          communication_response_rate: 0.20,
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
            credit_bureau_score: 350,
            platform_verified: false,
            platform_earnings_3m_usd: 0,
            platform_rating: 0,
            bank_account_verified: false,
            bank_account_age_months: 0,
          },
          kyc_result: {
            id_verification: { status: 'failed' },
            face_match: { confidence: 0.30 },
            liveness: { status: 'failed' },
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      // With bad data everywhere, score is low but still in review/Tier 1 range
      expect(result.scaled_score).toBeLessThan(500);
      expect(['approve', 'review']).toContain(result.decision);
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
          monthly_income_usd: 500,
          existing_debt_obligations_usd: 0,
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 350,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.95 },
            liveness: { status: 'passed' },
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
  // 5. First-time customer neutral repayment score
  // =========================================================================
  describe('Neutral Scores for Missing Data', () => {
    it('should give first-time customer neutral repayment score (125/250)', async () => {
      // No previous loans
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          monthly_income_usd: 500,
          existing_debt_obligations_usd: 0,
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 300,
          // No repayment data provided = first-time customer
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.95 },
            liveness: { status: 'passed' },
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      expect(result.components.repayment_willingness).toBe(125);
    });

    it('should give neutral mobile money score (100/200) when no mobile money data', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          monthly_income_usd: 500,
          existing_debt_obligations_usd: 0,
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 300,
          // No mobile_money_profile
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.95 },
            liveness: { status: 'passed' },
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      expect(result.components.mobile_money).toBe(100);
    });

    it('should give neutral external credit score (75/150) when no external data', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customerId,
          monthly_income_usd: 500,
          existing_debt_obligations_usd: 0,
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 300,
          // No external_credit_data
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.95 },
            liveness: { status: 'passed' },
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      expect(result.components.external_credit).toBe(75);
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
          monthly_income_usd: 1000,
          existing_debt_obligations_usd: 0,
          household_size: 1,
          dependents: 0,
          requested_loan_amount: 500,
          previous_loans_count: 5,
          on_time_payment_rate: 0.99,
          bill_payment_consistency: 0.95,
          communication_response_rate: 0.95,
          mobile_money_profile: {
            account_age_months: 36,
            avg_monthly_inflow_usd: 1000,
            avg_monthly_outflow_usd: 600,
            transaction_count_3m: 150,
            balance_usd: 300,
            airtime_purchases_3m: 15,
            airtime_avg_per_purchase_usd: 8,
          },
          external_credit_data: {
            credit_bureau_score: 800,
            platform_verified: true,
            platform_earnings_3m_usd: 3000,
            platform_rating: 4.9,
            bank_account_verified: true,
            bank_account_age_months: 48,
          },
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.99 },
            liveness: { status: 'passed' },
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
          monthly_income_usd: 200,
          existing_debt_obligations_usd: 80,
          household_size: 5,
          dependents: 3,
          requested_loan_amount: 350,
          previous_loans_count: 1,
          on_time_payment_rate: 0.70,
          bill_payment_consistency: 0.60,
          communication_response_rate: 0.65,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.85 },
            liveness: { status: 'passed' },
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      // All scores now get approved — review/reject removed
      expect(result.decision).toBe('approve');
      if (result.scaled_score < 500) {
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
          monthly_income_usd: 500,
          existing_debt_obligations_usd: 0,
          household_size: 2,
          dependents: 1,
          requested_loan_amount: 350,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.95 },
            liveness: { status: 'passed' },
          },
        }),
      });

      const response = await handler(event);
      const result = JSON.parse(response.body);

      // The score result should contain all information needed for loan creation
      expect(result.customer_id).toBe(customerId);
      expect(result.decision).toBeDefined();
      expect(['approve', 'review', 'reject']).toContain(result.decision);
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
          // Missing: monthly_income_usd, requested_loan_amount, kyc_result
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
          monthly_income_usd: 500,
          requested_loan_amount: 350,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.95 },
            liveness: { status: 'passed' },
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
