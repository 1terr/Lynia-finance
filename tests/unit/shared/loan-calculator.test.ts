import {
  calculateDecliningBalancePayment,
  getAllowedTerms,
  getAllowedTermsForProduct,
} from '../../../services/shared/utils/loan-calculator';

describe('calculateDecliningBalancePayment', () => {
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
  });

  it('uses simple division for 0% interest', () => {
    const result = calculateDecliningBalancePayment({
      principal: 600,
      annualRatePercent: 0,
      termMonths: 6,
    });
    expect(result.monthlyPayment).toBe(100);
    expect(result.totalRepayment).toBe(600);
    expect(result.totalInterest).toBe(0);
  });

  it('calculates $400 at 4% APR for 12 months correctly', () => {
    // This must match Fineract's declining balance schedule
    const result = calculateDecliningBalancePayment({
      principal: 400,
      annualRatePercent: 4,
      termMonths: 12,
    });
    expect(result.monthlyPayment).toBe(34.06);
    expect(result.totalRepayment).toBe(408.72);
    expect(result.totalInterest).toBe(8.72);
  });

  it('calculates $140 at 5% APR for 6 months correctly', () => {
    // Tier 1 example: $200 device, 30% down = $140 financed
    const result = calculateDecliningBalancePayment({
      principal: 140,
      annualRatePercent: 5,
      termMonths: 6,
    });
    expect(result.monthlyPayment).toBe(23.67);
    expect(result.totalRepayment).toBe(142.02);
    expect(result.totalInterest).toBe(2.02);
  });

  it('calculates $1800 at 3% APR for 18 months correctly', () => {
    // Tier 3 example: $2000 device, 10% down = $1800 financed
    const result = calculateDecliningBalancePayment({
      principal: 1800,
      annualRatePercent: 3,
      termMonths: 18,
    });
    expect(result.monthlyPayment).toBe(102.39);
    expect(result.totalRepayment).toBe(1843.02);
    expect(result.totalInterest).toBe(43.02);
  });

  it('handles 1-month term', () => {
    const result = calculateDecliningBalancePayment({
      principal: 100,
      annualRatePercent: 12,
      termMonths: 1,
    });
    // 1 month at 12% APR = 1% monthly rate → $101
    expect(result.monthlyPayment).toBe(101);
    expect(result.totalRepayment).toBe(101);
    expect(result.totalInterest).toBe(1);
  });

  it('returns positive interest for any non-zero rate', () => {
    const result = calculateDecliningBalancePayment({
      principal: 500,
      annualRatePercent: 1,
      termMonths: 12,
    });
    expect(result.totalInterest).toBeGreaterThan(0);
    expect(result.monthlyPayment).toBeGreaterThan(500 / 12);
  });
});

describe('getAllowedTermsForProduct', () => {
  it('returns standard terms within product range', () => {
    expect(getAllowedTermsForProduct(6, 18)).toEqual([6, 9, 12, 18]);
  });

  it('handles typical smartphone product (6-12 months)', () => {
    expect(getAllowedTermsForProduct(6, 12)).toEqual([6, 9, 12]);
  });

  it('returns empty array when no standard terms fit', () => {
    expect(getAllowedTermsForProduct(4, 5)).toEqual([]);
  });
});

describe('getAllowedTerms (deprecated)', () => {
  it('still works as backward-compat wrapper', () => {
    expect(getAllowedTerms('Tier 1')).toEqual([6, 9, 12]);
    expect(getAllowedTerms('Tier 3')).toEqual([6, 9, 12, 18]);
  });
});
