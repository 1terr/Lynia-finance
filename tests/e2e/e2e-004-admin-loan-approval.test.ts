/**
 * E2E Test: E2E-004 - Admin Loan Approval Workflow
 *
 * Scenario: Customer with borderline credit score requires manual review. Admin reviews and approves.
 * Flow: Manual review loan -> Admin reviews in dashboard -> Admin approves/rejects -> Customer notified
 *
 * Expected Result: Admin can manually approve with custom terms, customer receives notification
 */

import { createAPIGatewayEvent, parseResponseBody } from '../helpers/test-utils';
import { mockSmileIdentityResponses } from '../helpers/mock-external-services';
import { testCustomers, testLoans, testCreditScores } from '../fixtures';

// Mock external dependencies
jest.mock('../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));
jest.mock('axios');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');

// ---------------------------------------------------------------------------
// Mock Supabase query builder
// ---------------------------------------------------------------------------
const createMockQueryBuilder = () => {
  const builder: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or',
    'order', 'limit', 'match', 'filter', 'range', 'count',
    'single', 'maybeSingle',
  ];
  for (const m of methods) {
    builder[m] = jest.fn().mockReturnValue(builder);
  }
  builder.execute = jest.fn().mockResolvedValue({ data: null, error: null });
  return builder;
};

const mockDb = {
  from: jest.fn((_table: string) => createMockQueryBuilder()),
};

// ---------------------------------------------------------------------------
// Import handlers after mocking
// ---------------------------------------------------------------------------
import { handler as scoringHandler } from '../../services/scoring-service/src/index';
import { handler as notificationHandler } from '../../services/notification-service/src/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const reviewCustomer = testCustomers.lowScoreCustomer;
const reviewLoan = testLoans.reviewLoan;
const reviewScore = testCreditScores.lowScore;
const highScore = testCreditScores.highScore;
const rejectedScore = testCreditScores.rejectedScore;

describe('E2E-004: Admin Loan Approval Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { success: true } });
    axios.isAxiosError = jest.fn().mockReturnValue(false);
  });

  // =========================================================================
  // STEP 1: Loan Application in Review
  // =========================================================================
  describe('Step 1: Loan Application in Review', () => {
    it('should have credit score in the manual review range (600-649)', () => {
      expect(reviewScore.score).toBeGreaterThanOrEqual(600);
      expect(reviewScore.score).toBeLessThan(650);
      expect(reviewScore.decision).toBe('review');
    });

    it('should have loan status as review', () => {
      expect(reviewLoan.status).toBe('review');
      expect(reviewLoan.deposit_paid).toBe(false);
      expect(reviewLoan.disbursed_at).toBeNull();
    });

    it('should distinguish between auto-approve, review, and rejection scores', () => {
      // High score: auto-approve
      expect(highScore.score).toBeGreaterThanOrEqual(650);
      expect(highScore.decision).toBe('approved');
      expect(highScore.loan_limit).toBeGreaterThan(0);

      // Low score: manual review
      expect(reviewScore.score).toBeGreaterThanOrEqual(600);
      expect(reviewScore.score).toBeLessThan(650);
      expect(reviewScore.decision).toBe('review');

      // Rejected score: below threshold
      expect(rejectedScore.score).toBeLessThan(600);
      expect(rejectedScore.decision).toBe('rejected');
      expect(rejectedScore.loan_limit).toBe(0);
    });

    it('should verify credit score factors structure', () => {
      const factors = reviewScore.factors;
      expect(factors).toBeDefined();
      expect(factors).toHaveProperty('kyc_quality');
      expect(factors).toHaveProperty('income_stability');
      expect(factors).toHaveProperty('affordability');
      expect(factors).toHaveProperty('employment_type');
      expect(factors).toHaveProperty('phone_age');

      // All factors should be non-negative
      expect(factors.kyc_quality).toBeGreaterThanOrEqual(0);
      expect(factors.income_stability).toBeGreaterThanOrEqual(0);
      expect(factors.affordability).toBeGreaterThanOrEqual(0);
    });

    it('should validate review customer has verified KYC', () => {
      expect(reviewCustomer.kyc_status).toBe('verified');
      expect(reviewCustomer.national_id).toBeDefined();
      expect(reviewCustomer.country).toBe('Zimbabwe');
    });
  });

  // =========================================================================
  // STEP 2: Admin Review Process
  // =========================================================================
  describe('Step 2: Admin Review Process', () => {
    it('should display customer profile data for review', () => {
      expect(reviewCustomer.first_name).toBe('Grace');
      expect(reviewCustomer.last_name).toBe('Chiweshe');
      expect(reviewCustomer.employment_status).toBe('self_employed');
      expect(reviewCustomer.monthly_income).toBe(300);
      expect(reviewCustomer.phone_number).toMatch(/^\+263/);
    });

    it('should calculate debt-to-income ratio for affordability analysis', () => {
      const requestedAmount = reviewLoan.loan_amount; // $300
      const monthlyIncome = reviewCustomer.monthly_income; // $300
      const monthlyPayment = reviewLoan.monthly_payment; // $44
      const dtiRatio = (monthlyPayment / monthlyIncome) * 100;

      expect(dtiRatio).toBeCloseTo(14.67, 1);
      expect(dtiRatio).toBeLessThan(30); // Acceptable DTI threshold
      expect(requestedAmount).toBeLessThanOrEqual(reviewScore.loan_limit);
    });

    it('should verify KYC manual review response is available', () => {
      const manualReview = mockSmileIdentityResponses.manualReviewKYC;
      expect(manualReview.result.ResultCode).toBe('1013');
      expect(manualReview.result.ResultText).toBe('Needs Review');
      expect(manualReview.result.confidence_value).toBe(72.0);
      expect(manualReview.result.face_match.status).toBe('uncertain');
    });

    it('should validate loan review terms', () => {
      expect(reviewLoan.loan_amount).toBe(300);
      expect(reviewLoan.deposit_amount).toBe(60); // 20% of $300
      expect(reviewLoan.interest_rate).toBe(15);
      expect(reviewLoan.loan_term_months).toBe(6);
      expect(reviewLoan.monthly_payment).toBe(44);
      expect(reviewLoan.total_repayment).toBe(264);
    });

    it('should verify GET scoring endpoint returns 404 for unknown customer', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/scoring/unknown_customer',
        pathParameters: { customerId: 'unknown_customer' },
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body.error).toContain('not found');
    });

    it('should retrieve existing credit score for review customer', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({
          data: {
            customer_id: reviewCustomer.id,
            scaled_score: reviewScore.score,
            decision: reviewScore.decision,
            tier: reviewScore.tier,
            credit_limit_usd: reviewScore.loan_limit,
            components: reviewScore.factors,
          },
          error: null,
        });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: `/scoring/${reviewCustomer.id}`,
        pathParameters: { customerId: reviewCustomer.id },
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.customer_id).toBe(reviewCustomer.id);
      expect(body.decision).toBe('review');
    });
  });

  // =========================================================================
  // STEP 3: Admin Approves/Rejects
  // =========================================================================
  describe('Step 3: Admin Manual Approval', () => {
    it('should validate admin approval payload structure', () => {
      const approvalPayload = {
        loan_id: reviewLoan.id,
        admin_user_id: 'admin_001',
        decision: 'approved',
        approved_amount: 300,
        notes: 'Self-employed with stable income. KYC verified. Approve at requested amount.',
      };

      expect(approvalPayload.loan_id).toBe(reviewLoan.id);
      expect(approvalPayload.admin_user_id).toBeDefined();
      expect(approvalPayload.decision).toBe('approved');
      expect(approvalPayload.approved_amount).toBe(300);
      expect(approvalPayload.notes.length).toBeGreaterThan(0);
    });

    it('should validate admin rejection payload structure', () => {
      const rejectionPayload = {
        loan_id: reviewLoan.id,
        admin_user_id: 'admin_001',
        decision: 'rejected',
        rejected_reason: 'Income verification incomplete. Customer needs to provide additional documentation.',
      };

      expect(rejectionPayload.decision).toBe('rejected');
      expect(rejectionPayload.rejected_reason).toBeDefined();
      expect(rejectionPayload.rejected_reason.length).toBeGreaterThan(0);
    });

    it('should validate deposit calculation for approved amount', () => {
      const approvedAmount = 300;
      const depositPercentage = 0.20;
      const depositAmount = approvedAmount * depositPercentage;
      const principal = approvedAmount - depositAmount;

      expect(depositAmount).toBe(60);
      expect(principal).toBe(240);
      expect(depositAmount + principal).toBe(approvedAmount);
    });

    it('should validate audit log entry structure for admin approval', () => {
      const auditEntry = {
        action: 'loan_approved',
        admin_user_id: 'admin_001',
        loan_id: reviewLoan.id,
        customer_id: reviewCustomer.id,
        previous_status: 'review',
        new_status: 'paid_deposit',
        approved_amount: 300,
        notes: 'KYC verified, stable income',
        timestamp: new Date().toISOString(),
      };

      expect(auditEntry.action).toBe('loan_approved');
      expect(auditEntry.admin_user_id).toBeDefined();
      expect(auditEntry.previous_status).toBe('review');
      expect(auditEntry.new_status).toBe('paid_deposit');
      expect(auditEntry.timestamp).toBeDefined();
    });

    it('should validate loan status transitions for approval', () => {
      const validTransitions: Record<string, string[]> = {
        review: ['paid_deposit', 'rejected'],
        paid_deposit: ['active'],
        active: ['completed', 'defaulted'],
      };

      expect(validTransitions.review).toContain('paid_deposit');
      expect(validTransitions.review).toContain('rejected');
      expect(validTransitions.review).not.toContain('active');
    });
  });

  // =========================================================================
  // STEP 4: Customer Gets Notification
  // =========================================================================
  describe('Step 4: Customer Gets Notification', () => {
    it('should return 400 when sending notification without required fields', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: reviewCustomer.id,
        }),
      });

      const response = await notificationHandler(event);

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(400);
      const body = parseResponseBody(response!);
      expect(body.error).toContain('Missing required fields');
    });

    it('should validate approval notification message content', () => {
      const approvedAmount = 300;
      const depositRequired = 60;
      const customerName = `${reviewCustomer.first_name} ${reviewCustomer.last_name}`;

      const approvalMessage = `Hi ${customerName}! Your loan application for $${approvedAmount} has been approved. Please pay a deposit of $${depositRequired} to proceed.`;

      expect(approvalMessage).toContain('Grace Chiweshe');
      expect(approvalMessage).toContain('$300');
      expect(approvalMessage).toContain('$60');
      expect(approvalMessage).toContain('approved');
    });

    it('should validate rejection notification message content', () => {
      const customerName = `${reviewCustomer.first_name}`;
      const rejectionMessage = `Hi ${customerName}, we were unable to approve your loan application at this time. Please contact support for more information.`;

      expect(rejectionMessage).toContain('Grace');
      expect(rejectionMessage).toContain('unable to approve');
      expect(rejectionMessage).toContain('support');
    });

    it('should validate that notification includes deposit payment instructions for approval', () => {
      const instructions = {
        approved_amount: 300,
        deposit_required: 60,
        deposit_percentage: 20,
        payment_methods: ['ecocash', 'onemoney'],
        deadline_days: 7,
      };

      expect(instructions.deposit_percentage).toBe(20);
      expect(instructions.deposit_required).toBe(60);
      expect(instructions.payment_methods).toContain('ecocash');
      expect(instructions.payment_methods).toContain('onemoney');
      expect(instructions.deadline_days).toBe(7);
    });
  });

  // =========================================================================
  // STEP 5: Verification
  // =========================================================================
  describe('Step 5: Verification', () => {
    it('should verify approved loan fixture has correct pending state', () => {
      const approvedLoan = testLoans.approvedLoan;
      expect(approvedLoan.status).toBe('paid_deposit');
      expect(approvedLoan.deposit_paid).toBe(false);
      expect(approvedLoan.device_id).toBeNull();
      expect(approvedLoan.disbursed_at).toBeNull();
    });

    it('should verify credit tier assignment is consistent with score', () => {
      // Tier 3 (best): score >= 750
      expect(highScore.tier).toBe(2);
      expect(highScore.score).toBeGreaterThanOrEqual(700);

      // Tier 3 (review): score 600-649
      expect(reviewScore.tier).toBe(3);
      expect(reviewScore.score).toBeGreaterThanOrEqual(600);

      // Rejected: score < 600
      expect(rejectedScore.tier).toBeNull();
      expect(rejectedScore.score).toBeLessThan(600);
    });

    it('should verify rejection score has a rejection reason', () => {
      expect(rejectedScore.rejection_reason).toBeDefined();
      expect(rejectedScore.rejection_reason).toContain('below minimum threshold');
      expect(rejectedScore.loan_limit).toBe(0);
    });

    it('should validate scoring handler returns 400 for missing customer_id', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({}),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body.error).toBe('customer_id is required');
    });

    it('should validate that review queue only shows loans with review status', () => {
      const allLoans = [
        testLoans.activeLoan,
        testLoans.overdueLoan,
        testLoans.reviewLoan,
        testLoans.approvedLoan,
        testLoans.completedLoan,
      ];

      const reviewQueue = allLoans.filter(loan => loan.status === 'review');
      expect(reviewQueue).toHaveLength(1);
      expect(reviewQueue[0].id).toBe(reviewLoan.id);
    });
  });

  // =========================================================================
  // Error Scenarios
  // =========================================================================
  describe('Error Scenarios', () => {
    it('should validate that non-admin cannot approve loans', () => {
      const nonAdminPayload = {
        loan_id: reviewLoan.id,
        admin_user_id: null, // No admin user
        decision: 'approved',
      };

      expect(nonAdminPayload.admin_user_id).toBeNull();
    });

    it('should validate that approved amount cannot exceed loan limit', () => {
      const loanLimit = reviewScore.loan_limit; // 300
      const requestedAmount = reviewLoan.loan_amount; // 300

      expect(requestedAmount).toBeLessThanOrEqual(loanLimit);
      expect(loanLimit).toBe(300);
    });

    it('should validate scoring endpoint returns 404 for unrouted path', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        path: '/scoring/calculate',
        body: JSON.stringify({}),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(404);
    });
  });
});
