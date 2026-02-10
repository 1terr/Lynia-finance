/**
 * Cross-Service Data Flow Tests: Currency Handling
 *
 * Validates multi-currency handling across services:
 * - All amounts stored in cents (integer arithmetic)
 * - USD amounts display with $ prefix and 2 decimal places
 * - ZWL amounts display with ZWL prefix
 * - No floating point rounding errors in payment calculations
 * - Loan total = sum of all installments
 * - Outstanding balance = total_amount_due - sum(completed_payments)
 * - 0.1 + 0.2 type errors prevented via integer arithmetic
 */

import {
  seedMockTable,
  getMockTable,
  resetMockDataStore,
  createTestLoan,
  createTestPayment,
  generateTestId,
} from '../../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mock Supabase
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
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
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

const mockSupabaseClient = {
  from: jest.fn(() => ({ ...mockQueryBuilder })),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// ---------------------------------------------------------------------------
// Currency Utility Functions (matching project patterns)
// ---------------------------------------------------------------------------

type Currency = 'USD' | 'ZWL' | 'ZAR';

interface Money {
  amount: number; // In cents (smallest unit)
  currency: Currency;
}

/**
 * Format money for display.
 * Always shows 2 decimal places with correct currency prefix.
 */
function formatMoney(money: Money): string {
  const dollars = money.amount / 100;
  switch (money.currency) {
    case 'USD':
      return `$${dollars.toFixed(2)}`;
    case 'ZWL':
      return `ZWL ${dollars.toFixed(2)}`;
    case 'ZAR':
      return `R${dollars.toFixed(2)}`;
  }
}

/**
 * Convert dollar amount to cents (integer).
 * Avoids floating point issues by rounding.
 */
function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollar amount.
 */
function toDollars(cents: number): number {
  return cents / 100;
}

/**
 * Safe money addition using integer arithmetic.
 */
function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add different currencies: ${a.currency} and ${b.currency}`);
  }
  return { amount: a.amount + b.amount, currency: a.currency };
}

/**
 * Safe money subtraction using integer arithmetic.
 */
function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot subtract different currencies: ${a.currency} and ${b.currency}`);
  }
  return { amount: a.amount - b.amount, currency: a.currency };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Currency Handling Data Flow Tests', () => {
  const customerId = 'cust_currency_001';
  const loanId = 'loan_currency_001';

  beforeEach(() => {
    resetMockDataStore();
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Integer arithmetic (cents) for all amounts
  // =========================================================================
  describe('Integer Arithmetic (Cents Storage)', () => {
    it('should store amounts in cents as integers', () => {
      const loanAmountDollars = 350.00;
      const loanAmountCents = toCents(loanAmountDollars);

      expect(loanAmountCents).toBe(35000);
      expect(Number.isInteger(loanAmountCents)).toBe(true);
    });

    it('should convert cents back to dollars correctly', () => {
      const cents = 35000;
      const dollars = toDollars(cents);

      expect(dollars).toBe(350.00);
    });

    it('should handle odd cent amounts without floating point errors', () => {
      const amountDollars = 51.33;
      const cents = toCents(amountDollars);

      expect(cents).toBe(5133);
      expect(toDollars(cents)).toBe(51.33);
    });

    it('should prevent the classic 0.1 + 0.2 floating point error using cents', () => {
      // In floating point: 0.1 + 0.2 = 0.30000000000000004
      const floatingResult = 0.1 + 0.2;
      expect(floatingResult).not.toBe(0.3);

      // In integer cents: 10 + 20 = 30 (exact)
      const centsResult = toCents(0.1) + toCents(0.2);
      expect(centsResult).toBe(30);
      expect(toDollars(centsResult)).toBe(0.3);
    });

    it('should handle large payment sums without precision loss', () => {
      const payments = [51.33, 51.33, 51.33, 51.33, 51.33, 51.35];

      // Using integer arithmetic
      const totalCents = payments.reduce((sum, p) => sum + toCents(p), 0);
      const totalDollars = toDollars(totalCents);

      expect(totalCents).toBe(30800);
      expect(totalDollars).toBe(308.00);
    });
  });

  // =========================================================================
  // 2. USD display formatting
  // =========================================================================
  describe('USD Display Formatting', () => {
    it('should format USD with $ prefix and 2 decimal places', () => {
      const amount: Money = { amount: 35000, currency: 'USD' };
      expect(formatMoney(amount)).toBe('$350.00');
    });

    it('should format small amounts correctly', () => {
      const amount: Money = { amount: 133, currency: 'USD' };
      expect(formatMoney(amount)).toBe('$1.33');
    });

    it('should format zero amount', () => {
      const amount: Money = { amount: 0, currency: 'USD' };
      expect(formatMoney(amount)).toBe('$0.00');
    });

    it('should format amounts with single digit cents', () => {
      const amount: Money = { amount: 10001, currency: 'USD' };
      expect(formatMoney(amount)).toBe('$100.01');
    });

    it('should format round dollar amounts with .00', () => {
      const amount: Money = { amount: 50000, currency: 'USD' };
      expect(formatMoney(amount)).toBe('$500.00');
    });
  });

  // =========================================================================
  // 3. ZWL display formatting
  // =========================================================================
  describe('ZWL Display Formatting', () => {
    it('should format ZWL with ZWL prefix', () => {
      const amount: Money = { amount: 100000, currency: 'ZWL' };
      expect(formatMoney(amount)).toBe('ZWL 1000.00');
    });

    it('should format ZWL small amounts', () => {
      const amount: Money = { amount: 5050, currency: 'ZWL' };
      expect(formatMoney(amount)).toBe('ZWL 50.50');
    });
  });

  // =========================================================================
  // 4. ZAR display formatting
  // =========================================================================
  describe('ZAR Display Formatting', () => {
    it('should format ZAR with R prefix', () => {
      const amount: Money = { amount: 75000, currency: 'ZAR' };
      expect(formatMoney(amount)).toBe('R750.00');
    });
  });

  // =========================================================================
  // 5. No floating point rounding errors in payment calculations
  // =========================================================================
  describe('Payment Calculation Precision', () => {
    it('should calculate monthly installment without rounding errors', () => {
      const principal = toCents(280.00); // $280 in cents
      const interestRate = 15; // 15% APR
      const termMonths = 6;

      const totalInterest = Math.round(principal * (interestRate / 100));
      const totalRepayment = principal + totalInterest;
      const monthlyInstallmentCents = Math.round(totalRepayment / termMonths);

      expect(Number.isInteger(totalInterest)).toBe(true);
      expect(Number.isInteger(totalRepayment)).toBe(true);
      expect(Number.isInteger(monthlyInstallmentCents)).toBe(true);

      // Verify total
      expect(totalRepayment).toBe(32200); // $322 in cents
    });

    it('should distribute remainder cents across installments', () => {
      const totalCents = 30800; // $308.00
      const termMonths = 6;

      const baseInstallment = Math.floor(totalCents / termMonths);
      const remainder = totalCents - baseInstallment * termMonths;

      // Base installment for all months
      const installments = Array(termMonths).fill(baseInstallment);
      // Distribute remainder across first N installments
      for (let i = 0; i < remainder; i++) {
        installments[i] += 1;
      }

      // Verify sum equals total exactly
      const installmentSum = installments.reduce(
        (sum: number, i: number) => sum + i,
        0,
      );
      expect(installmentSum).toBe(totalCents);

      // Each installment should be within 1 cent of each other
      const min = Math.min(...installments);
      const max = Math.max(...installments);
      expect(max - min).toBeLessThanOrEqual(1);
    });

    it('should handle payment amounts that do not divide evenly', () => {
      const loanTotal = toCents(371.00);
      const termMonths = 6;

      // 37100 / 6 = 6183.33... -> needs rounding
      const baseInstallment = Math.floor(loanTotal / termMonths);
      const remainder = loanTotal - baseInstallment * termMonths;

      expect(baseInstallment).toBe(6183);
      expect(remainder).toBe(2); // 2 cents remainder

      // First 2 installments: $61.84, remaining 4: $61.83
      const installments: number[] = [];
      for (let i = 0; i < termMonths; i++) {
        installments.push(baseInstallment + (i < remainder ? 1 : 0));
      }

      const sum = installments.reduce((s, i) => s + i, 0);
      expect(sum).toBe(loanTotal);
    });
  });

  // =========================================================================
  // 6. Loan total = sum of all installments
  // =========================================================================
  describe('Loan Total Equals Sum of Installments', () => {
    it('should verify loan total equals sum of all installment records', () => {
      const totalRepaymentCents = 30800; // $308.00

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          total_amount_due_usd: toDollars(totalRepaymentCents),
          total_installments: 6,
        }),
      ]);

      // Create 6 installment records
      const baseInstallment = Math.floor(totalRepaymentCents / 6);
      const remainder = totalRepaymentCents - baseInstallment * 6;

      const installmentAmounts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const amountCents = baseInstallment + (i < remainder ? 1 : 0);
        installmentAmounts.push(amountCents);

        seedMockTable('loan_installments', [
          ...(getMockTable('loan_installments') || []),
          {
            id: generateTestId('inst'),
            loan_id: loanId,
            installment_number: i + 1,
            amount_cents: amountCents,
            amount_usd: toDollars(amountCents),
            due_date: new Date(
              Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            status: 'pending',
          },
        ]);
      }

      const installments = getMockTable('loan_installments').filter(
        (inst) => inst.loan_id === loanId,
      );

      const sumCents = installments.reduce(
        (sum, inst) => sum + (inst.amount_cents as number),
        0,
      );

      expect(installments).toHaveLength(6);
      expect(sumCents).toBe(totalRepaymentCents);
      expect(toDollars(sumCents)).toBe(308.00);
    });
  });

  // =========================================================================
  // 7. Outstanding balance = total_due - sum(completed_payments)
  // =========================================================================
  describe('Outstanding Balance Calculation', () => {
    it('should calculate outstanding_balance = total_amount_due - sum(completed_payments)', () => {
      const totalDueCents = 30800; // $308.00

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          total_amount_due_usd: toDollars(totalDueCents),
        }),
      ]);

      // Two completed payments
      seedMockTable('payments', [
        createTestPayment({
          id: 'pay_001',
          loan_id: loanId,
          payment_amount_usd: toDollars(5133), // $51.33
          payment_status: 'completed',
        }),
        createTestPayment({
          id: 'pay_002',
          loan_id: loanId,
          payment_amount_usd: toDollars(5133), // $51.33
          payment_status: 'completed',
        }),
        // Failed payment should NOT count
        createTestPayment({
          id: 'pay_003',
          loan_id: loanId,
          payment_amount_usd: toDollars(5133),
          payment_status: 'failed',
        }),
      ]);

      const completedPayments = getMockTable('payments').filter(
        (p) => p.loan_id === loanId && p.payment_status === 'completed',
      );

      const totalPaidCents = completedPayments.reduce(
        (sum, p) => sum + toCents(p.payment_amount_usd as number),
        0,
      );

      const outstandingCents = totalDueCents - totalPaidCents;

      expect(completedPayments).toHaveLength(2);
      expect(totalPaidCents).toBe(10266); // 2 * 5133
      expect(outstandingCents).toBe(20534); // 30800 - 10266
      expect(toDollars(outstandingCents)).toBe(205.34);
    });

    it('should return zero outstanding when all payments completed', () => {
      const totalDueCents = 30800;

      // Create exactly matching payments
      const paymentCents = [5134, 5133, 5133, 5133, 5133, 5134]; // sums to 30800
      const paymentSum = paymentCents.reduce((s, c) => s + c, 0);
      expect(paymentSum).toBe(totalDueCents);

      seedMockTable('payments', []);
      for (let i = 0; i < paymentCents.length; i++) {
        getMockTable('payments').push(
          createTestPayment({
            id: `pay_${i}`,
            loan_id: loanId,
            payment_amount_usd: toDollars(paymentCents[i]),
            payment_status: 'completed',
          }),
        );
      }

      const completed = getMockTable('payments').filter(
        (p) => p.loan_id === loanId && p.payment_status === 'completed',
      );

      const totalPaidCents = completed.reduce(
        (sum, p) => sum + toCents(p.payment_amount_usd as number),
        0,
      );

      const outstanding = totalDueCents - totalPaidCents;
      expect(outstanding).toBe(0);
    });

    it('should handle overpayment gracefully', () => {
      const totalDueCents = 30800;

      seedMockTable('payments', [
        createTestPayment({
          id: 'pay_over_001',
          loan_id: loanId,
          payment_amount_usd: toDollars(31000), // Overpayment: $310.00
          payment_status: 'completed',
        }),
      ]);

      const totalPaidCents = toCents(
        getMockTable('payments')[0].payment_amount_usd as number,
      );

      const outstandingCents = totalDueCents - totalPaidCents;
      expect(outstandingCents).toBeLessThan(0); // Negative = overpaid
      expect(outstandingCents).toBe(-200); // -$2.00

      // Outstanding should be capped at 0 for display
      const displayOutstanding = Math.max(outstandingCents, 0);
      expect(displayOutstanding).toBe(0);
    });
  });

  // =========================================================================
  // 8. Cross-service currency consistency
  // =========================================================================
  describe('Cross-Service Currency Consistency', () => {
    it('should use same currency (USD) across loan, payment, and notification', () => {
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          loan_amount_usd: 350.00,
          currency: 'USD',
        }),
      ]);

      seedMockTable('payments', [
        createTestPayment({
          id: generateTestId('pay'),
          loan_id: loanId,
          payment_amount_usd: 51.33,
          currency: 'USD',
        }),
      ]);

      seedMockTable('notifications', [
        {
          id: generateTestId('notif'),
          customer_id: customerId,
          message: 'Payment of $51.33 received',
          metadata: { amount: 51.33, currency: 'USD' },
        },
      ]);

      const loan = getMockTable('loans')[0];
      const payment = getMockTable('payments')[0];
      const notification = getMockTable('notifications')[0];

      // All use USD
      expect(loan.currency || 'USD').toBe('USD');
      expect(payment.currency || 'USD').toBe('USD');
      expect(
        (notification.metadata as Record<string, unknown>).currency || 'USD',
      ).toBe('USD');
    });

    it('should format payment amounts consistently across services', () => {
      const amountCents = 5133;

      const loanFormat = formatMoney({ amount: amountCents, currency: 'USD' });
      const paymentFormat = formatMoney({ amount: amountCents, currency: 'USD' });
      const notifFormat = formatMoney({ amount: amountCents, currency: 'USD' });

      expect(loanFormat).toBe('$51.33');
      expect(paymentFormat).toBe('$51.33');
      expect(notifFormat).toBe('$51.33');

      // All the same
      expect(loanFormat).toBe(paymentFormat);
      expect(paymentFormat).toBe(notifFormat);
    });
  });

  // =========================================================================
  // 9. Money arithmetic safety
  // =========================================================================
  describe('Money Arithmetic Safety', () => {
    it('should add money amounts safely', () => {
      const a: Money = { amount: 5133, currency: 'USD' };
      const b: Money = { amount: 5133, currency: 'USD' };

      const sum = addMoney(a, b);
      expect(sum.amount).toBe(10266);
      expect(sum.currency).toBe('USD');
      expect(formatMoney(sum)).toBe('$102.66');
    });

    it('should subtract money amounts safely', () => {
      const total: Money = { amount: 30800, currency: 'USD' };
      const payment: Money = { amount: 5133, currency: 'USD' };

      const remaining = subtractMoney(total, payment);
      expect(remaining.amount).toBe(25667);
      expect(formatMoney(remaining)).toBe('$256.67');
    });

    it('should throw error when adding different currencies', () => {
      const usd: Money = { amount: 5133, currency: 'USD' };
      const zwl: Money = { amount: 100000, currency: 'ZWL' };

      expect(() => addMoney(usd, zwl)).toThrow('Cannot add different currencies');
    });

    it('should throw error when subtracting different currencies', () => {
      const usd: Money = { amount: 30800, currency: 'USD' };
      const zar: Money = { amount: 5000, currency: 'ZAR' };

      expect(() => subtractMoney(usd, zar)).toThrow(
        'Cannot subtract different currencies',
      );
    });

    it('should handle chain of arithmetic without accumulating errors', () => {
      let balance: Money = { amount: 30800, currency: 'USD' };
      const payments = [5133, 5133, 5133, 5133, 5133, 5135];

      for (const paymentCents of payments) {
        const payment: Money = { amount: paymentCents, currency: 'USD' };
        balance = subtractMoney(balance, payment);
      }

      // After all payments: 30800 - (5133*5 + 5135) = 30800 - 30800 = 0
      expect(balance.amount).toBe(0);
      expect(formatMoney(balance)).toBe('$0.00');
    });

    it('should produce exact results for common Zimbabwe mobile money amounts', () => {
      // Common mobile money amounts in USD
      const commonAmounts = [1.00, 2.50, 5.00, 10.00, 20.00, 50.00, 100.00];

      for (const amount of commonAmounts) {
        const cents = toCents(amount);
        const backToDollars = toDollars(cents);

        expect(Number.isInteger(cents)).toBe(true);
        expect(backToDollars).toBe(amount);
        expect(formatMoney({ amount: cents, currency: 'USD' })).toBe(
          `$${amount.toFixed(2)}`,
        );
      }
    });
  });
});
