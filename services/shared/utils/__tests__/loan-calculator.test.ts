/**
 * Unit tests for services/shared/utils/loan-calculator.ts
 *
 * Tests declining balance payment calculation, 0% APR handling,
 * rounding, and edge cases (zero amounts, negative, boundary values).
 */

import {
  calculateDecliningBalancePayment,
  getAllowedTerms,
} from '../loan-calculator';

describe('calculateDecliningBalancePayment', () => {
  // ─── 0% APR: Simple Division ───────────────────────────────────

  it('0% APR: simple principal / term', () => {
    const result = calculateDecliningBalancePayment({
      principal: 600,
      annualRatePercent: 0,
      termMonths: 6,
    });
    expect(result.monthlyPayment).toBe(100);
    expect(result.totalRepayment).toBe(600);
    expect(result.totalInterest).toBe(0);
  });

  it('0% APR: handles non-even division with rounding', () => {
    const result = calculateDecliningBalancePayment({
      principal: 100,
      annualRatePercent: 0,
      termMonths: 3,
    });
    expect(result.monthlyPayment).toBe(33.33);
    expect(result.totalRepayment).toBe(99.99);
    expect(result.totalInterest).toBe(0);
  });

  // ─── Standard Declining Balance ────────────────────────────────

  it('$400 at 4% APR for 12 months (Fineract-matching)', () => {
    const result = calculateDecliningBalancePayment({
      principal: 400,
      annualRatePercent: 4,
      termMonths: 12,
    });
    expect(result.monthlyPayment).toBe(34.06);
    expect(result.totalRepayment).toBe(408.72);
    expect(result.totalInterest).toBe(8.72);
  });

  it('$140 at 5% APR for 6 months (Tier 1 example)', () => {
    const result = calculateDecliningBalancePayment({
      principal: 140,
      annualRatePercent: 5,
      termMonths: 6,
    });
    expect(result.monthlyPayment).toBe(23.67);
    expect(result.totalRepayment).toBe(142.02);
    expect(result.totalInterest).toBe(2.02);
  });

  it('$1800 at 3% APR for 18 months (Tier 3 example)', () => {
    const result = calculateDecliningBalancePayment({
      principal: 1800,
      annualRatePercent: 3,
      termMonths: 18,
    });
    expect(result.monthlyPayment).toBe(102.39);
    expect(result.totalRepayment).toBe(1843.02);
    expect(result.totalInterest).toBe(43.02);
  });

  it('1-month term at 12% APR', () => {
    const result = calculateDecliningBalancePayment({
      principal: 100,
      annualRatePercent: 12,
      termMonths: 1,
    });
    expect(result.monthlyPayment).toBe(101);
    expect(result.totalRepayment).toBe(101);
    expect(result.totalInterest).toBe(1);
  });

  // ─── Rounding to 2 Decimal Places ─────────────────────────────

  it('monthly payment is rounded to 2 decimal places', () => {
    const result = calculateDecliningBalancePayment({
      principal: 333,
      annualRatePercent: 7,
      termMonths: 9,
    });
    const decimalParts = result.monthlyPayment.toString().split('.');
    if (decimalParts[1]) {
      expect(decimalParts[1].length).toBeLessThanOrEqual(2);
    }
  });

  it('total payment = sum of all monthly payments (totalRepayment = monthlyPayment * term)', () => {
    const result = calculateDecliningBalancePayment({
      principal: 500,
      annualRatePercent: 5,
      termMonths: 12,
    });
    const expectedTotal = Math.round(result.monthlyPayment * 12 * 100) / 100;
    expect(result.totalRepayment).toBe(expectedTotal);
  });

  it('total interest = total payment - principal', () => {
    const result = calculateDecliningBalancePayment({
      principal: 500,
      annualRatePercent: 5,
      termMonths: 12,
    });
    expect(result.totalInterest).toBe(
      Math.round((result.totalRepayment - 500) * 100) / 100
    );
  });

  // ─── Edge Cases ────────────────────────────────────────────────

  it('returns zeros for zero principal', () => {
    const result = calculateDecliningBalancePayment({
      principal: 0,
      annualRatePercent: 5,
      termMonths: 12,
    });
    expect(result.monthlyPayment).toBe(0);
    expect(result.totalRepayment).toBe(0);
    expect(result.totalInterest).toBe(0);
  });

  it('returns zeros for zero term', () => {
    const result = calculateDecliningBalancePayment({
      principal: 400,
      annualRatePercent: 4,
      termMonths: 0,
    });
    expect(result.monthlyPayment).toBe(0);
    expect(result.totalRepayment).toBe(0);
    expect(result.totalInterest).toBe(0);
  });

  it('returns zeros for negative principal', () => {
    const result = calculateDecliningBalancePayment({
      principal: -100,
      annualRatePercent: 5,
      termMonths: 12,
    });
    expect(result.monthlyPayment).toBe(0);
  });

  it('returns zeros for negative term', () => {
    const result = calculateDecliningBalancePayment({
      principal: 100,
      annualRatePercent: 5,
      termMonths: -6,
    });
    expect(result.monthlyPayment).toBe(0);
  });

  it('positive interest for any non-zero APR', () => {
    const result = calculateDecliningBalancePayment({
      principal: 500,
      annualRatePercent: 1,
      termMonths: 12,
    });
    expect(result.totalInterest).toBeGreaterThan(0);
    expect(result.monthlyPayment).toBeGreaterThan(500 / 12);
  });

  it('handles very small principal ($1)', () => {
    const result = calculateDecliningBalancePayment({
      principal: 1,
      annualRatePercent: 5,
      termMonths: 12,
    });
    expect(result.monthlyPayment).toBeGreaterThan(0);
    expect(result.totalRepayment).toBeGreaterThanOrEqual(1);
  });

  it('handles large principal ($50000)', () => {
    const result = calculateDecliningBalancePayment({
      principal: 50000,
      annualRatePercent: 10,
      termMonths: 36,
    });
    expect(result.monthlyPayment).toBeGreaterThan(0);
    expect(result.totalInterest).toBeGreaterThan(0);
    expect(result.totalRepayment).toBeGreaterThan(50000);
  });
});

describe('getAllowedTerms', () => {
  it('Tier 1: returns [6, 12]', () => {
    expect(getAllowedTerms('Tier 1')).toEqual([6, 12]);
  });

  it('Tier 2: returns [6, 12]', () => {
    expect(getAllowedTerms('Tier 2')).toEqual([6, 12]);
  });

  it('Tier 3: returns [6, 12, 18]', () => {
    expect(getAllowedTerms('Tier 3')).toEqual([6, 12, 18]);
  });

  it('unknown tier: defaults to [6, 12]', () => {
    expect(getAllowedTerms('Unknown')).toEqual([6, 12]);
  });

  it('empty string: defaults to [6, 12]', () => {
    expect(getAllowedTerms('')).toEqual([6, 12]);
  });
});
