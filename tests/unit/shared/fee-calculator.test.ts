/**
 * Unit tests for frontend fee calculator.
 * Validates that the frontend port matches backend logic exactly.
 */

import { calculateInsuranceFee, calculateFlatRatePayment } from '../../../frontend/apps/admin-portal/src/lib/utils/fee-calculator';

describe('calculateInsuranceFee', () => {
  it('should return zeros when feeType is none', () => {
    const result = calculateInsuranceFee({
      loanAmount: 500,
      feeType: 'none',
      feePercentage: 5,
      feeFlatUsd: 10,
      frequency: 'upfront',
      termMonths: 12,
    });
    expect(result).toEqual({ upfrontFee: 0, monthlyFee: 0, totalFee: 0 });
  });

  it('should return zeros when termMonths is 0', () => {
    const result = calculateInsuranceFee({
      loanAmount: 500,
      feeType: 'percentage',
      feePercentage: 5,
      feeFlatUsd: 0,
      frequency: 'upfront',
      termMonths: 0,
    });
    expect(result).toEqual({ upfrontFee: 0, monthlyFee: 0, totalFee: 0 });
  });

  it('should calculate upfront percentage fee correctly', () => {
    const result = calculateInsuranceFee({
      loanAmount: 1000,
      feeType: 'percentage',
      feePercentage: 5,
      feeFlatUsd: 0,
      frequency: 'upfront',
      termMonths: 12,
    });
    expect(result.upfrontFee).toBe(50);
    expect(result.monthlyFee).toBe(0);
    expect(result.totalFee).toBe(50);
  });

  it('should calculate monthly percentage fee correctly', () => {
    const result = calculateInsuranceFee({
      loanAmount: 1000,
      feeType: 'percentage',
      feePercentage: 2,
      feeFlatUsd: 0,
      frequency: 'monthly',
      termMonths: 6,
    });
    expect(result.upfrontFee).toBe(0);
    expect(result.monthlyFee).toBe(20);
    expect(result.totalFee).toBe(120);
  });

  it('should use flat amount for upfront flat fee', () => {
    const result = calculateInsuranceFee({
      loanAmount: 500,
      feeType: 'flat',
      feePercentage: 0,
      feeFlatUsd: 25,
      frequency: 'upfront',
      termMonths: 12,
    });
    expect(result.upfrontFee).toBe(25);
    expect(result.monthlyFee).toBe(0);
    expect(result.totalFee).toBe(25);
  });

  it('should use flat amount for monthly flat fee', () => {
    const result = calculateInsuranceFee({
      loanAmount: 500,
      feeType: 'flat',
      feePercentage: 0,
      feeFlatUsd: 10,
      frequency: 'monthly',
      termMonths: 6,
    });
    expect(result.upfrontFee).toBe(0);
    expect(result.monthlyFee).toBe(10);
    expect(result.totalFee).toBe(60);
  });

  it('should round percentage calculations to 2 decimal places', () => {
    const result = calculateInsuranceFee({
      loanAmount: 333,
      feeType: 'percentage',
      feePercentage: 3.33,
      feeFlatUsd: 0,
      frequency: 'upfront',
      termMonths: 12,
    });
    // 333 * 3.33 / 100 = 11.0889 -> rounds to 11.09
    expect(result.upfrontFee).toBe(11.09);
    expect(result.totalFee).toBe(11.09);
  });
});

describe('calculateFlatRatePayment', () => {
  it('should return zeros for termMonths <= 0', () => {
    const result = calculateFlatRatePayment({
      principal: 500,
      annualRatePercent: 48,
      termMonths: 0,
    });
    expect(result).toEqual({ monthlyPayment: 0, totalRepayment: 0, totalInterest: 0, effectiveApr: 0 });
  });

  it('should handle 0% interest rate', () => {
    const result = calculateFlatRatePayment({
      principal: 600,
      annualRatePercent: 0,
      termMonths: 6,
    });
    expect(result.monthlyPayment).toBe(100);
    expect(result.totalRepayment).toBe(600);
    expect(result.totalInterest).toBe(0);
    expect(result.effectiveApr).toBe(0);
  });

  it('should calculate flat rate interest correctly', () => {
    const result = calculateFlatRatePayment({
      principal: 1000,
      annualRatePercent: 48,
      termMonths: 12,
    });
    // totalInterest = 1000 * 0.48 * (12/12) = 480
    expect(result.totalInterest).toBe(480);
    // totalRepayment = 1000 + 480 = 1480
    expect(result.totalRepayment).toBe(1480);
    // monthlyPayment = 1480 / 12 = 123.33
    expect(result.monthlyPayment).toBe(123.33);
    // effectiveApr = (480 / 1000) * (12/12) * 100 = 48
    expect(result.effectiveApr).toBe(48);
  });

  it('should calculate correct effective APR for partial-year terms', () => {
    const result = calculateFlatRatePayment({
      principal: 500,
      annualRatePercent: 48,
      termMonths: 6,
    });
    // totalInterest = 500 * 0.48 * (6/12) = 120
    expect(result.totalInterest).toBe(120);
    // totalRepayment = 500 + 120 = 620
    expect(result.totalRepayment).toBe(620);
    // monthlyPayment = 620 / 6 = 103.33
    expect(result.monthlyPayment).toBe(103.33);
    // effectiveApr = (120 / 500) * (12/6) * 100 = 48
    expect(result.effectiveApr).toBe(48);
  });

  it('should round all monetary values to 2 decimal places', () => {
    const result = calculateFlatRatePayment({
      principal: 333,
      annualRatePercent: 33,
      termMonths: 7,
    });
    // totalInterest = 333 * 0.33 * (7/12) = 64.1025 -> 64.1
    expect(result.totalInterest).toBe(64.1);
    // totalRepayment = 333 + 64.1 = 397.1
    expect(result.totalRepayment).toBe(397.1);
    // monthlyPayment = 397.1 / 7 = 56.7285... -> 56.73
    expect(result.monthlyPayment).toBe(56.73);
  });
});
