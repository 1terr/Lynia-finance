/**
 * Frontend Fee Calculator
 *
 * Pure-function port of the backend fee-calculator and loan-calculator logic.
 * Used for live fee simulation preview in the product wizard.
 * No Node.js dependencies -- browser-safe.
 */

export interface InsuranceFeeParams {
  loanAmount: number;
  feeType: 'percentage' | 'flat' | 'none';
  feePercentage: number;
  feeFlatUsd: number;
  frequency: 'upfront' | 'monthly';
  termMonths: number;
}

export interface InsuranceFeeResult {
  upfrontFee: number;
  monthlyFee: number;
  totalFee: number;
}

/**
 * Calculate insurance fee -- exact port of backend calculateInsuranceFee.
 */
export function calculateInsuranceFee(params: InsuranceFeeParams): InsuranceFeeResult {
  const { loanAmount, feeType, feePercentage, feeFlatUsd, frequency, termMonths } = params;

  if (feeType === 'none' || termMonths <= 0) {
    return { upfrontFee: 0, monthlyFee: 0, totalFee: 0 };
  }

  const baseFee = feeType === 'percentage'
    ? Math.round(loanAmount * feePercentage / 100 * 100) / 100
    : feeFlatUsd;

  if (frequency === 'upfront') {
    return { upfrontFee: baseFee, monthlyFee: 0, totalFee: baseFee };
  }

  // Monthly frequency: fee is charged each month
  const monthlyFee = Math.round(baseFee * 100) / 100;
  return { upfrontFee: 0, monthlyFee, totalFee: Math.round(monthlyFee * termMonths * 100) / 100 };
}

/**
 * Calculate flat rate loan payment -- exact port of backend calculateFlatRatePayment.
 */
export function calculateFlatRatePayment(params: {
  principal: number;
  annualRatePercent: number;
  termMonths: number;
}): { monthlyPayment: number; totalRepayment: number; totalInterest: number; effectiveApr: number } {
  const { principal, annualRatePercent, termMonths } = params;

  if (termMonths <= 0) {
    return { monthlyPayment: 0, totalRepayment: 0, totalInterest: 0, effectiveApr: 0 };
  }

  if (annualRatePercent === 0) {
    const monthlyPayment = Math.round(principal / termMonths * 100) / 100;
    return { monthlyPayment, totalRepayment: principal, totalInterest: 0, effectiveApr: 0 };
  }

  // Flat rate: interest = principal * annual_rate * (term_in_years)
  const totalInterest = Math.round(principal * (annualRatePercent / 100) * (termMonths / 12) * 100) / 100;
  const totalRepayment = Math.round((principal + totalInterest) * 100) / 100;
  const monthlyPayment = Math.round(totalRepayment / termMonths * 100) / 100;

  // Effective APR for regulatory disclosure
  const effectiveApr = Math.round((totalInterest / principal) * (12 / termMonths) * 100 * 100) / 100;

  return { monthlyPayment, totalRepayment, totalInterest, effectiveApr };
}
