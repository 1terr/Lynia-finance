/**
 * Unit Tests: Credit Scoring State Handler
 *
 * Tests the credit_scoring onboarding state that calls the scoring service,
 * handles approval/rejection, and routes smartphone vs digital credit paths.
 */

import { handleCreditScoring } from '../credit-scoring';
import type { OnboardingSession, MessageContext } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateSession = jest.fn();
jest.mock('../../session', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: { post: (...args: unknown[]) => mockAxiosPost(...args) },
}));

jest.mock('../../../i18n', () => ({
  t: (key: string, _lang?: string) => {
    const map: Record<string, string> = {
      scoring_unavailable: 'We are experiencing a temporary issue assessing your application.',
    };
    return map[key] || key;
  },
}));

jest.mock('../../../../../shared/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Database mock — supports both `db` (QueryBuilder) and `query` (raw SQL)
const mockDbExecute = jest.fn();
const mockQueryFn = jest.fn();

jest.mock('../../../../../shared/clients/database', () => {
  // Chain builder that accumulates calls and returns itself, then executes
  const createChainBuilder = () => {
    const chain: Record<string, jest.Mock> = {};
    chain.select = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.limit = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockReturnValue(chain);
    chain.execute = jest.fn().mockImplementation(() => mockDbExecute());
    return chain;
  };

  return {
    db: {
      from: jest.fn(() => createChainBuilder()),
    },
    query: (...args: unknown[]) => mockQueryFn(...args),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSmartphoneSession(overrides: Partial<OnboardingSession['state_data']> = {}): OnboardingSession {
  return {
    customer_id: 'cust-001',
    phone_number: '+263771234567',
    current_state: 'credit_scoring',
    state_data: {
      selected_product: 'smartphone',
      monthly_income_usd: 400,
      requested_loan_amount: 250,
      household_size: 3,
      dependents: 1,
      existing_debt_obligations_usd: 50,
      employment_type: 'formal',
      preferred_language: 'en',
      ...overrides,
    },
    last_activity_at: new Date(),
    created_at: new Date(),
  };
}

function makeDigitalSession(overrides: Partial<OnboardingSession['state_data']> = {}): OnboardingSession {
  return {
    customer_id: 'cust-001',
    phone_number: '+263771234567',
    current_state: 'credit_scoring',
    state_data: {
      selected_product: 'digital_credit',
      monthly_income_usd: 500,
      requested_loan_amount: 300,
      household_size: 4,
      dependents: 2,
      existing_debt_obligations_usd: 0,
      employment_type: 'formal',
      preferred_language: 'en',
      org_lending_limits: {
        max_loan_amount: 1000,
        min_loan_amount: 20,
        interest_rate_monthly: 1,
        interest_rate_apr: 12,
        min_term_months: 3,
        max_term_months: 12,
      },
      ...overrides,
    },
    last_activity_at: new Date(),
    created_at: new Date(),
  };
}

function makeContext(message: string): MessageContext {
  return {
    from: '+263771234567',
    message,
    messageId: 'msg-test-004',
    timestamp: Date.now(),
  };
}

/** Set up standard mock responses for a successful scoring call */
function setupApprovalMocks(options: {
  kycStatus?: string;
  kycDecision?: string;
  scoreResult?: Record<string, unknown>;
  devices?: Array<{ id: string; brand: string; model_name: string; retail_price_usd: number }>;
} = {}) {
  const {
    kycStatus = 'verified',
    kycDecision = 'APPROVED',
    scoreResult = {
      decision: 'approve',
      scaled_score: 620,
      tier: 'Standard Smartphone Loan',
      credit_limit_usd: 500,
      down_payment_percentage: 20,
      interest_rate_apr: 4,
      matched_product_id: 'prod-002',
      matched_product_code: 'SMRT_FIN_001',
    },
    devices = [
      { id: 'dev-001', brand: 'Tecno', model_name: 'Spark 20', retail_price_usd: 120 },
      { id: 'dev-002', brand: 'Samsung', model_name: 'A15', retail_price_usd: 180 },
    ],
  } = options;

  // KYC submission lookup via db.from('kyc_submissions')
  mockDbExecute.mockResolvedValueOnce({
    data: {
      verification_confidence: 95,
      face_match_score: 90,
      liveness_score: 80,
      verification_decision: kycDecision,
      status: kycStatus,
    },
  });

  // Repayment history queries (two query() calls for loans + payments)
  mockQueryFn
    .mockResolvedValueOnce({ data: [{ loan_count: '0', total_missed: '0' }] }) // loans
    .mockResolvedValueOnce({ data: [{ confirmed_payments: '0' }] });           // payments

  // Scoring API call
  mockAxiosPost.mockResolvedValueOnce({ status: 200, data: scoreResult });

  // resolveSmartphoneProduct query
  mockQueryFn.mockResolvedValueOnce({ data: [{ id: 'prod-001' }] });

  // product_device_models count query
  mockQueryFn.mockResolvedValueOnce({ data: [{ count: '0' }] });

  // fetchAvailableDevices query
  mockQueryFn.mockResolvedValueOnce({ data: devices });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleCreditScoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SCORING_API_URL = 'https://api.test.lynia.finance/scoring/calculate';
  });

  afterEach(() => {
    delete process.env.SCORING_API_URL;
  });

  // ── Missing required fields ─────────────────────────────────────────

  describe('missing required fields', () => {
    it('returns error when requested_loan_amount is missing', async () => {
      const session = makeSmartphoneSession({ requested_loan_amount: undefined });
      const result = await handleCreditScoring(session, makeContext('check'));

      expect(result).toContain('missing some information');
      expect(result).toContain('RESTART');
    });

    it('returns error when household_size is missing', async () => {
      const session = makeSmartphoneSession({ household_size: undefined });
      const result = await handleCreditScoring(session, makeContext('check'));

      expect(result).toContain('missing some information');
    });

    it('does not include monthly_income_usd in required fields', async () => {
      setupApprovalMocks();
      const session = makeSmartphoneSession({ monthly_income_usd: undefined });
      const result = await handleCreditScoring(session, makeContext('check'));

      // monthly_income_usd is no longer required, so scoring should proceed (not fail validation)
      expect(result).not.toContain('missing some information');
      // Verify scoring API was called (passed validation)
      expect(mockAxiosPost).toHaveBeenCalled();
    });
  });

  // ── KYC not found or not verified ──────────────────────────────────

  describe('KYC verification gate', () => {
    it('blocks scoring when no KYC submission exists', async () => {
      mockDbExecute.mockResolvedValueOnce({ data: null });

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      expect(result).toContain('identity verification is incomplete');
      expect(result).toContain('RESTART');
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    it('blocks scoring when KYC status is not verified', async () => {
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 50,
          face_match_score: 40,
          liveness_score: 30,
          verification_decision: 'MANUAL_REVIEW',
          status: 'pending',
        },
      });

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      expect(result).toContain('identity verification is still being processed');
      expect(result).toContain('SUPPORT');
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    it('allows scoring when status is verified', async () => {
      setupApprovalMocks({ kycStatus: 'verified', kycDecision: 'APPROVED' });

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      expect(mockAxiosPost).toHaveBeenCalled();
      expect(result).toContain('Approved');
    });

    it('allows scoring when verification_decision is APPROVED even if status differs', async () => {
      // Edge case: status is 'pending' but decision is 'APPROVED'
      // The code checks: status !== 'verified' && decision !== 'APPROVED'
      // So if decision IS 'APPROVED', scoring proceeds
      setupApprovalMocks({ kycStatus: 'pending', kycDecision: 'APPROVED' });

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      expect(mockAxiosPost).toHaveBeenCalled();
    });
  });

  // ── Smartphone approval ─────────────────────────────────────────────

  describe('smartphone approval', () => {
    it('transitions to device_selection with device list', async () => {
      const devices = [
        { id: 'dev-001', brand: 'Tecno', model_name: 'Spark 20', retail_price_usd: 120 },
        { id: 'dev-002', brand: 'Samsung', model_name: 'A15', retail_price_usd: 180 },
      ];
      setupApprovalMocks({ devices });

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'device_selection',
        state_data: expect.objectContaining({
          credit_score: 620,
          credit_tier: 'Standard Smartphone Loan',
          credit_limit_usd: 500,
          down_payment_percentage: 20,
          interest_rate_apr: 4,
          decision: 'approve',
          available_devices: devices,
        }),
      }));

      expect(result).toContain('Congratulations');
      expect(result).toContain('Approved');
      expect(result).toContain('Tecno Spark 20 - $120');
      expect(result).toContain('Samsung A15 - $180');
      expect(result).toContain('Reply with the number');
    });

    it('shows credit score and tier in approval message', async () => {
      setupApprovalMocks({
        scoreResult: {
          decision: 'approve',
          scaled_score: 720,
          tier: 'Tier 3',
          credit_limit_usd: 800,
          down_payment_percentage: 15,
          interest_rate_apr: 3,
        },
      });

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      expect(result).toContain('720');
      expect(result).toContain('$800');
    });

    it('handles zero devices — stays in credit_scoring state', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95,
          face_match_score: 90,
          liveness_score: 80,
          verification_decision: 'APPROVED',
          status: 'verified',
        },
      });
      // Repayment history
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '0', total_missed: '0' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '0' }] });
      // Scoring API
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          decision: 'approve',
          scaled_score: 620,
          tier: 'Tier 2',
          credit_limit_usd: 500,
          down_payment_percentage: 20,
          interest_rate_apr: 4,
        },
      });
      // resolveSmartphoneProduct
      mockQueryFn.mockResolvedValueOnce({ data: [{ id: 'prod-001' }] });
      // product_device_models count
      mockQueryFn.mockResolvedValueOnce({ data: [{ count: '0' }] });
      // fetchAvailableDevices — empty
      mockQueryFn.mockResolvedValueOnce({ data: [] });

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      expect(result).toContain('Congratulations');
      expect(result).toContain('no devices currently available');
      expect(result).toContain('support@lynia.finance');

      // Should NOT transition to device_selection
      const updateCall = mockUpdateSession.mock.calls[0][1];
      expect(updateCall.current_state).toBeUndefined(); // Stays in credit_scoring
    });
  });

  // ── Digital credit approval ──────────────────────────────────────────

  describe('digital credit approval', () => {
    it('transitions to amount_selection (skips device_selection)', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95,
          face_match_score: 90,
          liveness_score: 80,
          verification_decision: 'APPROVED',
          status: 'verified',
        },
      });
      // Repayment history
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '0', total_missed: '0' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '0' }] });
      // Scoring API
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          decision: 'approve',
          scaled_score: 550,
          tier: 'Tier 1',
          credit_limit_usd: 600,
          down_payment_percentage: 0,
          interest_rate_apr: 5,
        },
      });

      const result = await handleCreditScoring(makeDigitalSession(), makeContext('check'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'amount_selection',
        state_data: expect.objectContaining({
          credit_score: 550,
          credit_tier: 'Tier 1',
          credit_limit_usd: 600, // Capped by org limit of 1000 — 600 < 1000 so no cap
          down_payment_percentage: 0,
          decision: 'approve',
        }),
      }));

      expect(result).toContain('Congratulations');
      expect(result).toContain('Approved');
      expect(result).toContain('How much would you like to borrow');
    });

    it('caps credit limit to org max_loan_amount', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95, face_match_score: 90,
          liveness_score: 80, verification_decision: 'APPROVED', status: 'verified',
        },
      });
      // Repayment history
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '0', total_missed: '0' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '0' }] });
      // Scoring returns limit higher than org allows
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          decision: 'approve',
          scaled_score: 700,
          tier: 'Tier 3',
          credit_limit_usd: 2000, // Higher than org limit
          down_payment_percentage: 0,
          interest_rate_apr: 5,
        },
      });

      const session = makeDigitalSession({
        org_lending_limits: {
          max_loan_amount: 1000,
          min_loan_amount: 50,
          interest_rate_monthly: 1,
          interest_rate_apr: 12,
          min_term_months: 3,
          max_term_months: 12,
        },
      });

      await handleCreditScoring(session, makeContext('check'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.credit_limit_usd).toBe(1000); // Capped
    });

    it('uses org interest rate when available', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95, face_match_score: 90,
          liveness_score: 80, verification_decision: 'APPROVED', status: 'verified',
        },
      });
      // Repayment history
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '0', total_missed: '0' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '0' }] });
      // Scoring API
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          decision: 'approve',
          scaled_score: 550,
          tier: 'Tier 1',
          credit_limit_usd: 500,
          interest_rate_apr: 5,
        },
      });

      await handleCreditScoring(makeDigitalSession(), makeContext('check'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      // Org interest_rate_apr is 12, should override the scoring service's 5
      expect(callArgs.state_data.interest_rate_apr).toBe(12);
    });
  });

  // ── Rejection ───────────────────────────────────────────────────────

  describe('rejection', () => {
    it('transitions to rejected state on score rejection', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95, face_match_score: 90,
          liveness_score: 80, verification_decision: 'APPROVED', status: 'verified',
        },
      });
      // Repayment history
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '0', total_missed: '0' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '0' }] });
      // Scoring API — rejection
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          decision: 'reject',
          scaled_score: 280,
          tier: 'Tier 1',
        },
      });

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'rejected',
        state_data: expect.objectContaining({
          credit_score: 280,
          decision: 'reject',
        }),
      }));

      expect(result).toContain('unable to approve');
      expect(result).toContain('280/850');
      expect(result).toContain('How to improve');
      expect(result).toContain('SUPPORT');
    });

    it('handles duplicate loan (409) response', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95, face_match_score: 90,
          liveness_score: 80, verification_decision: 'APPROVED', status: 'verified',
        },
      });
      // Repayment history
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '1', total_missed: '0' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '6' }] });
      // Scoring API — 409 duplicate
      mockAxiosPost.mockResolvedValueOnce({ status: 409, data: {} });

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'rejected',
        state_data: expect.objectContaining({
          decision: 'reject',
          rejection_reason: 'existing_loan',
        }),
      }));

      expect(result).toContain('already have an active loan');
      expect(result).toContain('BALANCE');
    });
  });

  // ── Score-to-product mapping ─────────────────────────────────────────

  describe('score-to-product mapping', () => {
    const products = [
      { tier: 'Entry Product', score: 350 },
      { tier: 'Standard Product', score: 550 },
      { tier: 'Premium Product', score: 750 },
    ];

    for (const { tier, score } of products) {
      it(`stores ${tier} correctly in state_data`, async () => {
        setupApprovalMocks({
          scoreResult: {
            decision: 'approve',
            scaled_score: score,
            tier,
            credit_limit_usd: 500,
            down_payment_percentage: 20,
            interest_rate_apr: 4,
          },
        });

        await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

        const callArgs = mockUpdateSession.mock.calls[0][1];
        expect(callArgs.state_data.credit_tier).toBe(tier);
        expect(callArgs.state_data.credit_score).toBe(score);
      });
    }
  });

  // ── API error handling ──────────────────────────────────────────────

  describe('API error handling', () => {
    it('returns user-friendly message on scoring service error', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95, face_match_score: 90,
          liveness_score: 80, verification_decision: 'APPROVED', status: 'verified',
        },
      });
      // Repayment history
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '0', total_missed: '0' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '0' }] });
      // Scoring API — throws error
      mockAxiosPost.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      expect(result).toContain('temporary issue');
      expect(result).toContain('Reference: SCORE-');
      // Should NOT auto-approve
      expect(mockUpdateSession).not.toHaveBeenCalled();
    });

    it('returns user-friendly message on 500 status', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95, face_match_score: 90,
          liveness_score: 80, verification_decision: 'APPROVED', status: 'verified',
        },
      });
      // Repayment history
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '0', total_missed: '0' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '0' }] });
      // Scoring API — 500 (validateStatus allows < 500, so 500 throws)
      mockAxiosPost.mockRejectedValueOnce(new Error('Request failed with status code 500'));

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      expect(result).toContain('temporary issue');
    });

    it('throws on non-200 non-409 response from scoring', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95, face_match_score: 90,
          liveness_score: 80, verification_decision: 'APPROVED', status: 'verified',
        },
      });
      // Repayment history
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '0', total_missed: '0' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '0' }] });
      // Scoring API — 400 (below 500, so not thrown by axios)
      mockAxiosPost.mockResolvedValueOnce({
        status: 400,
        data: { error: 'Invalid payload' },
      });

      const result = await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      // 400 is not 200 or 409, so it throws "Scoring service returned status 400"
      // which is caught by the outer try-catch
      expect(result).toContain('temporary issue');
    });
  });

  // ── Repeat customer repayment history ────────────────────────────────

  describe('repeat customer repayment history', () => {
    it('includes repayment data in scoring payload for repeat customers', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95, face_match_score: 90,
          liveness_score: 80, verification_decision: 'APPROVED', status: 'verified',
        },
      });
      // Repayment history — repeat customer with 2 loans
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '2', total_missed: '1' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '11' }] });
      // Scoring API
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          decision: 'approve',
          scaled_score: 650,
          tier: 'Tier 2',
          credit_limit_usd: 500,
          down_payment_percentage: 20,
          interest_rate_apr: 4,
        },
      });
      // resolveSmartphoneProduct
      mockQueryFn.mockResolvedValueOnce({ data: [{ id: 'prod-001' }] });
      // product_device_models count
      mockQueryFn.mockResolvedValueOnce({ data: [{ count: '0' }] });
      // fetchAvailableDevices
      mockQueryFn.mockResolvedValueOnce({
        data: [{ id: 'dev-001', brand: 'Tecno', model_name: 'Spark 20', retail_price_usd: 120 }],
      });

      await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      // Verify the scoring payload includes repayment history
      const scoringPayload = mockAxiosPost.mock.calls[0][0] || mockAxiosPost.mock.calls[0][1];
      // The first arg is the URL, the second is the payload
      const payload = mockAxiosPost.mock.calls[0][1];
      expect(payload.previous_loans_count).toBe(2);
      // on_time_rate = 11 / (11 + 1) = 0.9166...
      expect(payload.on_time_payment_rate).toBeCloseTo(11 / 12, 4);
    });

    it('does not include repayment data for first-time customers', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95, face_match_score: 90,
          liveness_score: 80, verification_decision: 'APPROVED', status: 'verified',
        },
      });
      // Repayment history — new customer (0 loans)
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '0', total_missed: '0' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '0' }] });
      // Scoring API
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          decision: 'approve', scaled_score: 450, tier: 'Tier 1',
          credit_limit_usd: 300, down_payment_percentage: 25, interest_rate_apr: 5,
        },
      });
      // resolveSmartphoneProduct
      mockQueryFn.mockResolvedValueOnce({ data: [{ id: 'prod-001' }] });
      // product_device_models count
      mockQueryFn.mockResolvedValueOnce({ data: [{ count: '0' }] });
      // fetchAvailableDevices
      mockQueryFn.mockResolvedValueOnce({
        data: [{ id: 'dev-001', brand: 'Tecno', model_name: 'Pop 8', retail_price_usd: 80 }],
      });

      await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      const payload = mockAxiosPost.mock.calls[0][1];
      expect(payload.previous_loans_count).toBeUndefined();
      expect(payload.on_time_payment_rate).toBeUndefined();
    });
  });

  // ── Product category passthrough ─────────────────────────────────────

  describe('product category in scoring payload', () => {
    it('sends "smartphone" for smartphone product', async () => {
      setupApprovalMocks();

      await handleCreditScoring(makeSmartphoneSession(), makeContext('check'));

      const payload = mockAxiosPost.mock.calls[0][1];
      expect(payload.product_category).toBe('smartphone');
    });

    it('sends "digital" for digital_credit product', async () => {
      // KYC
      mockDbExecute.mockResolvedValueOnce({
        data: {
          verification_confidence: 95, face_match_score: 90,
          liveness_score: 80, verification_decision: 'APPROVED', status: 'verified',
        },
      });
      // Repayment history
      mockQueryFn
        .mockResolvedValueOnce({ data: [{ loan_count: '0', total_missed: '0' }] })
        .mockResolvedValueOnce({ data: [{ confirmed_payments: '0' }] });
      // Scoring API
      mockAxiosPost.mockResolvedValueOnce({
        status: 200,
        data: {
          decision: 'approve', scaled_score: 500, tier: 'Tier 1',
          credit_limit_usd: 500, interest_rate_apr: 5,
        },
      });

      await handleCreditScoring(makeDigitalSession(), makeContext('check'));

      const payload = mockAxiosPost.mock.calls[0][1];
      expect(payload.product_category).toBe('digital');
    });
  });
});
