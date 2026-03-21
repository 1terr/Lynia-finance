/**
 * Unit Tests: Term Selection State Handler
 *
 * Tests the term_selection onboarding state where customers pick a repayment
 * period. Covers both smartphone financing (deposit-based) and digital credit
 * (no deposit) paths, including flat rate calculation.
 */

import { handleTermSelection } from '../term-selection';
import { calculateFlatRatePayment } from '../../../../../shared/utils/loan-calculator';
import type { OnboardingSession, MessageContext } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateSession = jest.fn();
jest.mock('../../session', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

const mockQuery = jest.fn();
jest.mock('../../../../../shared/clients/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSmartphoneSession(overrides: Partial<OnboardingSession['state_data']> = {}): OnboardingSession {
  return {
    customer_id: 'cust-001',
    phone_number: '+263771234567',
    current_state: 'term_selection',
    state_data: {
      selected_product: 'smartphone',
      credit_tier: 'Standard Product',
      matched_product_id: 'prod-001',
      credit_limit_usd: 500,
      down_payment_percentage: 20,
      interest_rate_apr: 4,
      selected_device_id: 'dev-002',
      selected_device_price: 200,
      selected_device_name: 'Samsung Galaxy A15',
      allowed_terms: [6, 12],
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
    current_state: 'term_selection',
    state_data: {
      selected_product: 'digital_credit',
      credit_tier: 'Standard Product',
      matched_product_id: 'prod-001',
      credit_limit_usd: 500,
      down_payment_percentage: 0,
      interest_rate_apr: 4,
      requested_loan_amount: 300,
      allowed_terms: [6, 12],
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
    messageId: 'msg-test-003',
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleTermSelection', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Smartphone path: deposit & principal calculation ─────────────────

  describe('smartphone path', () => {
    it('calculates deposit as 20% of device price', async () => {
      // Device price: $200, 20% down = $40 deposit
      await handleTermSelection(makeSmartphoneSession(), makeContext('1'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.deposit_amount).toBe(40);
    });

    it('calculates financed amount as device price minus deposit', async () => {
      // $200 - $40 deposit = $160 financed
      await handleTermSelection(makeSmartphoneSession(), makeContext('1'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.financed_amount).toBe(160);
    });

    it('uses custom down_payment_percentage when set', async () => {
      const session = makeSmartphoneSession({ down_payment_percentage: 25 });
      await handleTermSelection(session, makeContext('1'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      // $200 * 25% = $50 deposit, $150 financed
      expect(callArgs.state_data.deposit_amount).toBe(50);
      expect(callArgs.state_data.financed_amount).toBe(150);
    });

    it('defaults down_payment_percentage to 20 when missing', async () => {
      const session = makeSmartphoneSession({ down_payment_percentage: undefined });
      await handleTermSelection(session, makeContext('1'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.deposit_amount).toBe(40); // 20% of $200
    });

    it('stores correct term, payment, and total for 6-month term', async () => {
      // $160 at 4% flat rate for 6 months
      const expected = calculateFlatRatePayment({
        principal: 160,
        annualRatePercent: 4,
        termMonths: 6,
      });

      await handleTermSelection(makeSmartphoneSession(), makeContext('1'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'loan_summary',
        state_data: expect.objectContaining({
          selected_term_months: 6,
          monthly_payment: expected.monthlyPayment,
          total_repayment: expected.totalRepayment,
          financed_amount: 160,
          deposit_amount: 40,
        }),
      }));
    });

    it('stores correct values for 12-month term', async () => {
      const expected = calculateFlatRatePayment({
        principal: 160,
        annualRatePercent: 4,
        termMonths: 12,
      });

      await handleTermSelection(makeSmartphoneSession(), makeContext('2'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.selected_term_months).toBe(12);
      expect(callArgs.state_data.monthly_payment).toBe(expected.monthlyPayment);
      expect(callArgs.state_data.total_repayment).toBe(expected.totalRepayment);
    });

    it('response includes device name, price, deposit, and term info', async () => {
      const result = await handleTermSelection(makeSmartphoneSession(), makeContext('1'));

      expect(result).toContain('Samsung Galaxy A15');
      expect(result).toContain('$200.00');         // price
      expect(result).toContain('$40.00');           // deposit
      expect(result).toContain('$160.00');          // financed
      expect(result).toContain('6 months');
      expect(result).toContain('4% flat rate');
      expect(result).toContain('Monthly Payment');
      expect(result).toContain('Total Repayment');
      expect(result).toContain('Reply *Yes*');
    });

    it('clears allowed_terms from state_data after selection', async () => {
      await handleTermSelection(makeSmartphoneSession(), makeContext('1'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.allowed_terms).toBeUndefined();
    });
  });

  // ── Digital credit path: no deposit ──────────────────────────────────

  describe('digital credit path', () => {
    it('uses requested_loan_amount as principal (no deposit)', async () => {
      await handleTermSelection(makeDigitalSession(), makeContext('1'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.deposit_amount).toBe(0);
      expect(callArgs.state_data.financed_amount).toBe(300);
    });

    it('calculates correct payment for digital credit', async () => {
      const expected = calculateFlatRatePayment({
        principal: 300,
        annualRatePercent: 4,
        termMonths: 6,
      });

      await handleTermSelection(makeDigitalSession(), makeContext('1'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.monthly_payment).toBe(expected.monthlyPayment);
      expect(callArgs.state_data.total_repayment).toBe(expected.totalRepayment);
    });

    it('response shows Cash Loan instead of Device', async () => {
      const result = await handleTermSelection(makeDigitalSession(), makeContext('1'));

      expect(result).toContain('Cash Loan: $300.00');
      expect(result).not.toContain('Device:');
      expect(result).not.toContain('Deposit:');
    });

    it('handles digital credit with zero requested amount gracefully', async () => {
      const session = makeDigitalSession({ requested_loan_amount: 0 });
      await handleTermSelection(session, makeContext('1'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.financed_amount).toBe(0);
    });
  });

  // ── Flat rate calculation correctness ───────────────────────────────

  describe('flat rate calculation', () => {
    it('matches the loan-calculator utility output exactly', async () => {
      const principal = 160;
      const apr = 4;
      const term = 6;

      const calc = calculateFlatRatePayment({
        principal,
        annualRatePercent: apr,
        termMonths: term,
      });

      await handleTermSelection(makeSmartphoneSession(), makeContext('1'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.monthly_payment).toBe(calc.monthlyPayment);
      expect(callArgs.state_data.total_repayment).toBe(calc.totalRepayment);

      // Verify the numbers are reasonable
      expect(calc.monthlyPayment).toBeGreaterThan(principal / term); // Interest adds cost
      expect(calc.totalRepayment).toBeGreaterThan(principal);
    });

    it('uses interest_rate_apr from session state', async () => {
      const session = makeSmartphoneSession({ interest_rate_apr: 8 });
      await handleTermSelection(session, makeContext('1'));

      const expected = calculateFlatRatePayment({
        principal: 160,
        annualRatePercent: 8,
        termMonths: 6,
      });

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.monthly_payment).toBe(expected.monthlyPayment);
    });

    it('defaults interest_rate_apr to 4 when missing', async () => {
      const session = makeSmartphoneSession({ interest_rate_apr: undefined });
      await handleTermSelection(session, makeContext('1'));

      const expected = calculateFlatRatePayment({
        principal: 160,
        annualRatePercent: 4,
        termMonths: 6,
      });

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.monthly_payment).toBe(expected.monthlyPayment);
    });
  });

  // ── BACK command ────────────────────────────────────────────────────

  describe('BACK command', () => {
    it('goes to device_selection for smartphone path', async () => {
      mockQuery.mockResolvedValueOnce({
        data: [
          { id: 'dev-001', brand: 'Tecno', model_name: 'Spark 20', retail_price_usd: 120 },
        ],
      });

      const result = await handleTermSelection(makeSmartphoneSession(), makeContext('back'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'device_selection',
        state_data: expect.objectContaining({
          selected_device_id: undefined,
          selected_device_price: undefined,
          selected_device_name: undefined,
          allowed_terms: undefined,
        }),
      }));

      expect(result).toContain('Choose your smartphone');
    });

    it('goes to amount_selection for digital path', async () => {
      const result = await handleTermSelection(makeDigitalSession(), makeContext('back'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'amount_selection',
        state_data: expect.objectContaining({
          requested_loan_amount: undefined,
          allowed_terms: undefined,
        }),
      }));

      expect(result).toContain('How much would you like to borrow');
    });

    it('handles case-insensitive "BACK"', async () => {
      await handleTermSelection(makeDigitalSession(), makeContext('BACK'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'amount_selection',
      }));
    });

    it('smartphone BACK fetches devices from database filtered by credit limit', async () => {
      const session = makeSmartphoneSession({ credit_limit_usd: 200 });
      mockQuery.mockResolvedValueOnce({
        data: [
          { id: 'dev-001', brand: 'Tecno', model_name: 'Spark 20', retail_price_usd: 120 },
        ],
      });

      await handleTermSelection(session, makeContext('back'));

      // Verify the SQL query was called with the credit limit
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('retail_price_usd <= $1'),
        [200]
      );
    });

    it('smartphone BACK with no devices available shows support message', async () => {
      mockQuery.mockResolvedValueOnce({ data: [] });

      const result = await handleTermSelection(makeSmartphoneSession(), makeContext('back'));

      expect(result).toContain('No devices currently available');
      expect(result).toContain('support@lynia.finance');
    });

    it('smartphone BACK with null query result shows support message', async () => {
      mockQuery.mockResolvedValueOnce({ data: null });

      const result = await handleTermSelection(makeSmartphoneSession(), makeContext('back'));

      expect(result).toContain('No devices currently available');
    });

    it('digital BACK shows min and max amount in prompt', async () => {
      const session = makeDigitalSession({
        credit_limit_usd: 750,
        org_lending_limits: {
          max_loan_amount: 500,
          min_loan_amount: 50,
          interest_rate_monthly: 1,
          interest_rate_apr: 12,
          min_term_months: 3,
          max_term_months: 12,
        },
      });

      const result = await handleTermSelection(session, makeContext('back'));

      expect(result).toContain('$50');
      expect(result).toContain('$750.00'); // credit_limit_usd takes precedence over org max
    });

    it('digital BACK uses credit_limit_usd when org limits absent', async () => {
      const session = makeDigitalSession({
        credit_limit_usd: 400,
        org_lending_limits: undefined,
      });

      const result = await handleTermSelection(session, makeContext('back'));

      expect(result).toContain('$400.00');
    });
  });

  // ── Invalid input ───────────────────────────────────────────────────

  describe('invalid input', () => {
    it('returns error if no allowed_terms in session', async () => {
      const session = makeSmartphoneSession({ allowed_terms: undefined });
      const result = await handleTermSelection(session, makeContext('1'));

      expect(result).toContain('Something went wrong');
      expect(result).toContain('Restart');
      expect(mockUpdateSession).not.toHaveBeenCalled();
    });

    it('returns error for empty allowed_terms', async () => {
      const session = makeSmartphoneSession({ allowed_terms: [] });
      const result = await handleTermSelection(session, makeContext('1'));

      expect(result).toContain('Something went wrong');
    });

    it('re-shows term list for non-numeric input', async () => {
      const result = await handleTermSelection(makeSmartphoneSession(), makeContext('abc'));

      expect(result).toContain('Please reply with a number between 1 and 2');
      expect(result).toContain('6 months');
      expect(result).toContain('12 months');
      expect(mockUpdateSession).not.toHaveBeenCalled();
    });

    it('re-shows term list for out-of-range number', async () => {
      const result = await handleTermSelection(makeSmartphoneSession(), makeContext('5'));

      expect(result).toContain('between 1 and 2');
    });

    it('re-shows term list for zero', async () => {
      const result = await handleTermSelection(makeSmartphoneSession(), makeContext('0'));

      expect(result).toContain('Please reply with a number');
    });
  });

  // ── Three-term Tier 3 scenario ──────────────────────────────────────

  describe('three-term option (Tier 3)', () => {
    it('allows selection of 18-month term as option 3', async () => {
      const session = makeSmartphoneSession({
        allowed_terms: [6, 12, 18],
      });

      await handleTermSelection(session, makeContext('3'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      expect(callArgs.state_data.selected_term_months).toBe(18);
    });
  });
});
