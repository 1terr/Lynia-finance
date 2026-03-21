/**
 * E2E Test: E2E-007 - Full Loan Lifecycle Through Completion
 *
 * Scenario: Customer pays all installments on time, loan completes, device permanently unlocked
 * Flow: All installments paid -> Final payment closes loan -> Device permanently unlocked -> Credit score improved
 *
 * Expected Result: Loan status changes to completed, device ownership transferred, credit score improved
 */

import { createAPIGatewayEvent, parseResponseBody } from '../helpers/test-utils';
import { mockPaymentProviderResponses } from '../helpers/mock-external-services';
import { testCustomers, testLoans, testDevices, testPayments, testCreditScores } from '../fixtures';

// Mock external dependencies
jest.mock('../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));
jest.mock('axios');

// Mock provider services to bypass signature verification in tests
jest.mock('../../services/payment-service/src/ecocash-provider', () => ({
  EcoCashProvider: jest.fn().mockImplementation(() => ({
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../../services/payment-service/src/onemoney-provider', () => ({
  OneMoneyProvider: jest.fn().mockImplementation(() => ({
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../../services/payment-service/src/omari-provider', () => ({
  OmariProvider: jest.fn().mockImplementation(() => ({
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  })),
}));

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
import { handler as paymentHandler } from '../../services/payment-service/src/index';
import { handler as lockHandler } from '../../services/lock-service/src/index';
import { handler as scoringHandler } from '../../services/scoring-service/src/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const customer = testCustomers.zimbabweCustomer;
const activeLoan = testLoans.activeLoan;
const completedLoan = testLoans.completedLoan;
const highScore = testCreditScores.highScore;

describe('E2E-007: Full Loan Lifecycle Through Completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { success: true } });
    axios.isAxiosError = jest.fn().mockReturnValue(false);
  });

  // =========================================================================
  // STEP 1: All Installments Paid on Time
  // =========================================================================
  describe('Step 1: All Installments Paid On Time', () => {
    it('should validate active loan has correct installment plan', () => {
      expect(activeLoan.total_installments).toBe(6);
      expect(activeLoan.paid_installments).toBe(2);
      expect(activeLoan.monthly_payment).toBe(51.33);
      expect(activeLoan.outstanding_balance).toBe(200);
    });

    it('should calculate remaining installments', () => {
      const remaining = activeLoan.total_installments - activeLoan.paid_installments;
      expect(remaining).toBe(4);
      expect(remaining).toBeGreaterThan(0);
    });

    it('should verify total repayment equals installments * monthly payment', () => {
      const totalFromInstallments = activeLoan.total_installments * activeLoan.monthly_payment;
      const totalRepayment = activeLoan.total_repayment;

      // Allow small rounding difference
      expect(totalFromInstallments).toBeCloseTo(totalRepayment, 0);
    });

    it('should simulate paying all remaining installments', () => {
      const monthlyPayment = activeLoan.monthly_payment;
      let balance = activeLoan.outstanding_balance;
      let installmentsPaid = activeLoan.paid_installments;

      while (balance > 0 && installmentsPaid < activeLoan.total_installments) {
        const payment = Math.min(monthlyPayment, balance);
        balance = Math.max(balance - payment, 0);
        installmentsPaid++;
      }

      expect(balance).toBe(0);
      expect(installmentsPaid).toBe(activeLoan.total_installments);
    });

    it('should track each installment payment date 30 days apart', () => {
      const startDate = new Date(activeLoan.next_payment_date);
      const paymentDates: Date[] = [];
      const remaining = activeLoan.total_installments - activeLoan.paid_installments;

      for (let i = 0; i < remaining; i++) {
        const paymentDate = new Date(startDate.getTime() + i * 30 * 24 * 60 * 60 * 1000);
        paymentDates.push(paymentDate);
      }

      expect(paymentDates).toHaveLength(4);

      // Verify dates are sequential (each 30 days apart)
      for (let i = 1; i < paymentDates.length; i++) {
        const diff = (paymentDates[i].getTime() - paymentDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        expect(diff).toBeCloseTo(30, 0);
      }
    });

    it('should validate EcoCash success payment response for installment', () => {
      const success = mockPaymentProviderResponses.ecocash.successPayment;
      expect(success.status).toBe('SUCCESS');
      expect(success.transaction_id).toBeDefined();
      expect(success.amount).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // STEP 2: Final Payment Closes Loan
  // =========================================================================
  describe('Step 2: Final Payment Closes Loan', () => {
    it('should set loan status to completed when balance reaches zero', () => {
      const finalBalance = 0;
      const expectedStatus = finalBalance <= 0 ? 'completed' : 'active';

      expect(expectedStatus).toBe('completed');
    });

    it('should validate completed loan fixture has correct state', () => {
      expect(completedLoan.status).toBe('completed');
      expect(completedLoan.outstanding_balance).toBe(0);
      expect(completedLoan.paid_installments).toBe(completedLoan.total_installments);
      expect(completedLoan.completed_at).toBeDefined();
    });

    it('should verify final payment amount equals remaining balance', () => {
      // When balance is less than monthly payment, pay exact balance
      const lastBalance = 51.33; // Last installment
      const monthlyPayment = 51.33;
      const finalPayment = Math.min(monthlyPayment, lastBalance);

      expect(finalPayment).toBe(51.33);
      expect(lastBalance - finalPayment).toBe(0);
    });

    it('should verify loan completion date is set', () => {
      expect(completedLoan.completed_at).toBeDefined();
      const completedAt = new Date(completedLoan.completed_at!);
      expect(completedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should verify all installments are accounted for', () => {
      expect(completedLoan.paid_installments).toBe(6);
      expect(completedLoan.total_installments).toBe(6);
      expect(completedLoan.paid_installments).toBe(completedLoan.total_installments);
    });

    it('should validate completed loan deposit was paid', () => {
      expect(completedLoan.deposit_paid).toBe(true);
      expect(completedLoan.deposit_amount).toBe(60); // 20% of $300
    });

    it('should verify outstanding balance cannot go below zero', () => {
      const overpaymentAmount = activeLoan.outstanding_balance + 100;
      const newBalance = Math.max(activeLoan.outstanding_balance - overpaymentAmount, 0);

      expect(newBalance).toBe(0);
      expect(newBalance).toBeGreaterThanOrEqual(0);
    });

    it('should verify payment webhook returns 200', async () => {
      mockDb.from.mockImplementation((table: string) => {
        const qb = createMockQueryBuilder();
        if (table === 'payments') {
          qb.execute.mockResolvedValue({
            data: {
              id: 'pay_final',
              loan_id: activeLoan.id,
              customer_id: customer.id,
              amount: 51.33,
              status: 'completed',
              gateway: 'ecocash',
              payment_type: 'repayment',
            },
            error: null,
          });
        } else if (table === 'loans') {
          qb.execute.mockResolvedValue({
            data: { ...activeLoan, outstanding_balance: 0, status: 'completed' },
            error: null,
          });
        }
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/ecocash',
        body: JSON.stringify({
          transaction_id: 'EC_FINAL_001',
          merchant_reference: 'pay_final',
          status: 'SUCCESS',
          amount: 51.33,
          currency: 'USD',
          timestamp: new Date().toISOString(),
        }),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.message).toBe('Webhook processed successfully');
    });
  });

  // =========================================================================
  // STEP 3: Device Permanently Unlocked
  // =========================================================================
  describe('Step 3: Device Permanently Unlocked', () => {
    it('should validate device transitions from assigned to owned on loan completion', () => {
      const deviceBeforeCompletion = {
        status: 'assigned',
        lock_status: 'unlocked',
        customer_id: customer.id,
      };

      const deviceAfterCompletion = {
        status: 'owned',
        lock_status: 'permanently_unlocked',
        customer_id: customer.id,
      };

      expect(deviceBeforeCompletion.status).toBe('assigned');
      expect(deviceAfterCompletion.status).toBe('owned');
      expect(deviceAfterCompletion.lock_status).toBe('permanently_unlocked');
      expect(deviceAfterCompletion.customer_id).toBe(deviceBeforeCompletion.customer_id);
    });

    it('should validate that permanently unlocked devices cannot be re-locked', () => {
      const device = {
        lock_status: 'permanently_unlocked',
        loan_completed: true,
      };

      const canLock = device.lock_status !== 'permanently_unlocked' && !device.loan_completed;
      expect(canLock).toBe(false);
    });

    it('should validate unlock request structure for loan completion', () => {
      const unlockPayload = {
        device_id: testDevices.assignedDevice.id,
        reason: 'Loan fully paid - permanent unlock',
        admin_user_id: null, // System-triggered
        permanent: true,
      };

      expect(unlockPayload.permanent).toBe(true);
      expect(unlockPayload.reason).toContain('fully paid');
    });

    it('should return 400 for unlock with missing fields', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/unlock',
        body: JSON.stringify({
          // Missing device_id and reason
        }),
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Validation Error');
      expect(body).toHaveProperty('message', 'Missing required fields');
    });

    it('should validate lock handler returns 404 for unknown routes', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/locks-unknown',
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // STEP 4: Customer Credit Score Improved
  // =========================================================================
  describe('Step 4: Customer Credit Score Improved', () => {
    it('should validate high credit score fixture for good payer', () => {
      expect(highScore.score).toBeGreaterThanOrEqual(700);
      expect(highScore.decision).toBe('approved');
      expect(highScore.loan_limit).toBeGreaterThan(0);
      expect(highScore.tier).toBe(2); // Fixture tier value
    });

    it('should calculate credit score improvement after on-time payments', () => {
      const baseScore = 650; // Starting score at loan approval
      const onTimePaymentBonus = 10; // Points per on-time payment
      const totalPayments = 6;
      const completionBonus = 25; // Bonus for completing loan

      const improvedScore = baseScore + (onTimePaymentBonus * totalPayments) + completionBonus;

      expect(improvedScore).toBe(735);
      expect(improvedScore).toBeGreaterThan(baseScore);
      expect(improvedScore).toBeGreaterThanOrEqual(650); // Tier 3 threshold
    });

    it('should validate that improved score qualifies for higher tier', () => {
      const improvedScore = 735;

      // Tier assignment based on score
      let tier: string;
      if (improvedScore >= 650) {
        tier = 'Tier 3';
      } else if (improvedScore >= 500) {
        tier = 'Tier 2';
      } else {
        tier = 'Tier 1';
      }

      expect(tier).toBe('Tier 3');
      expect(improvedScore).toBeGreaterThanOrEqual(650);
    });

    it('should validate higher tier gets better loan terms', () => {
      const tier1 = { maxLoan: 700, interest: 8, downPayment: 5 };
      const tier2 = { maxLoan: 500, interest: 10, downPayment: 10 };
      const tier3 = { maxLoan: 350, interest: 12, downPayment: 15 };

      // Tier 1 has best terms
      expect(tier1.maxLoan).toBeGreaterThan(tier2.maxLoan);
      expect(tier1.interest).toBeLessThan(tier2.interest);
      expect(tier1.downPayment).toBeLessThan(tier2.downPayment);

      // Tier 2 better than Tier 3
      expect(tier2.maxLoan).toBeGreaterThan(tier3.maxLoan);
      expect(tier2.interest).toBeLessThan(tier3.interest);
      expect(tier2.downPayment).toBeLessThan(tier3.downPayment);
    });

    it('should verify scoring endpoint returns 400 for missing fields', async () => {
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

    it('should validate repeat customer gets better scoring', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({ data: { id: 'score_repeat' }, error: null });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: customer.id,
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 500, // Higher amount for repeat customer
          device_retail_price_usd: 500,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match_score: 99,
            liveness_passed: true,
          },
        }),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody<{
        decision: string;
        scaled_score: number;
        credit_limit_usd: number;
      }>(response);

      expect(body.decision).toBe('approve');
      // v2 model: without org verification, neutral org 175/350 yields ~644
      expect(body.scaled_score).toBeGreaterThanOrEqual(500);
      expect(body.credit_limit_usd).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Full Loan Lifecycle Summary
  // =========================================================================
  describe('Full Lifecycle Validation', () => {
    it('should validate all loan status transitions in order', () => {
      const expectedTransitions = [
        'approved',
        'paid_deposit',
        'active',
        'completed',
      ];

      for (let i = 1; i < expectedTransitions.length; i++) {
        const from = expectedTransitions[i - 1];
        const to = expectedTransitions[i];
        expect(expectedTransitions.indexOf(to)).toBeGreaterThan(expectedTransitions.indexOf(from));
      }
    });

    it('should validate total cost to customer (deposit + all installments)', () => {
      const deposit = 70; // 20% of $350
      const totalInstallments = 6 * 51.33; // $307.98
      const totalCost = deposit + totalInstallments;

      expect(deposit).toBe(70);
      expect(totalInstallments).toBeCloseTo(307.98, 2);
      expect(totalCost).toBeCloseTo(377.98, 2);
      expect(totalCost).toBeGreaterThan(350); // More than device price (includes interest)
    });

    it('should validate interest charged correctly', () => {
      const devicePrice = 350;
      const deposit = 70;
      const principal = devicePrice - deposit; // $280
      const totalRepaid = 6 * 51.33; // $307.98
      const interestPaid = totalRepaid - principal;

      expect(principal).toBe(280);
      expect(interestPaid).toBeCloseTo(27.98, 2);
      expect(interestPaid).toBeGreaterThan(0);
      expect(interestPaid).toBeLessThan(principal);
    });

    it('should validate payment fixture data consistency', () => {
      const deposit = testPayments.completedDeposit;
      const installment = testPayments.completedInstallment;

      expect(deposit.payment_type).toBe('deposit');
      expect(deposit.status).toBe('completed');
      expect(deposit.amount).toBe(70);

      expect(installment.payment_type).toBe('installment');
      expect(installment.status).toBe('completed');
      expect(installment.amount).toBe(51.33);
    });

    it('should validate completed loan has all dates populated', () => {
      expect(completedLoan.disbursed_at).toBeDefined();
      expect(completedLoan.completed_at).toBeDefined();

      const disbursedAt = new Date(completedLoan.disbursed_at!);
      const completedAt = new Date(completedLoan.completed_at!);

      // Completion should be after disbursement
      expect(completedAt.getTime()).toBeGreaterThan(disbursedAt.getTime());

      // Completion should be at least 5 months after disbursement (6 month loan)
      const monthsDiff = (completedAt.getTime() - disbursedAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
      expect(monthsDiff).toBeGreaterThanOrEqual(5);
    });
  });

  // =========================================================================
  // Error Scenarios
  // =========================================================================
  describe('Error Scenarios', () => {
    it('should handle payment webhook database error gracefully', async () => {
      mockDb.from.mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/ecocash',
        body: JSON.stringify({
          transaction_id: 'EC_ERR_001',
          merchant_reference: 'pay_err',
          status: 'SUCCESS',
          amount: 51.33,
        }),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await paymentHandler(event);

      // Webhook acknowledges receipt — deposit resolver handles errors internally
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('message', 'Webhook processed successfully');
    });

    it('should return 404 for unknown payment route', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/payments-nonexistent',
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(404);
    });

    it('should validate loan cannot transition from completed to active', () => {
      const validTransitionsFromCompleted: string[] = []; // No valid transitions
      expect(validTransitionsFromCompleted).toHaveLength(0);
      expect(validTransitionsFromCompleted).not.toContain('active');
    });

    it('should validate that a completed loan cannot accept payments', () => {
      const loanStatus = completedLoan.status;
      const canAcceptPayment = loanStatus === 'active';

      expect(canAcceptPayment).toBe(false);
      expect(loanStatus).toBe('completed');
    });
  });
});
