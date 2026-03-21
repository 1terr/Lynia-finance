/**
 * Fee calculator for loan product insurance and penalty charges.
 * Supports percentage-based and flat fee types with upfront or monthly frequency.
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

export interface LatePenaltyParams {
  overdueAmount: number;
  penaltyType: 'percentage' | 'flat' | 'none';
  penaltyPercentage: number;
  penaltyFlatUsd: number;
}

export function calculateLatePenalty(params: LatePenaltyParams): number {
  const { overdueAmount, penaltyType, penaltyPercentage, penaltyFlatUsd } = params;

  if (penaltyType === 'none') return 0;
  if (penaltyType === 'percentage') {
    return Math.round(overdueAmount * penaltyPercentage / 100 * 100) / 100;
  }
  return penaltyFlatUsd;
}
