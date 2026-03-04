/**
 * Loan Calculator Utilities
 *
 * Provides declining balance (equal installment) monthly payment calculation
 * that matches Fineract's amortizationType: 0, interestType: 0 configuration.
 *
 * Formula: M = P × [r(1+r)^n] / [(1+r)^n - 1]
 * Where: r = monthly rate, n = number of months, P = principal
 */

export interface LoanCalculationInput {
  /** Amount financed (device price minus deposit) */
  principal: number;
  /** Annual percentage rate as a percentage (e.g. 4 for 4%) */
  annualRatePercent: number;
  /** Number of monthly payments */
  termMonths: number;
}

export interface LoanCalculationResult {
  /** Monthly payment rounded to 2 decimal places */
  monthlyPayment: number;
  /** Total amount repaid over the loan term */
  totalRepayment: number;
  /** Total interest paid (totalRepayment - principal) */
  totalInterest: number;
}

/**
 * Calculate monthly payment using declining balance equal installment formula.
 * Matches Fineract's calculation: amortizationType=0, interestType=0.
 */
export function calculateDecliningBalancePayment(
  input: LoanCalculationInput
): LoanCalculationResult {
  const { principal, annualRatePercent, termMonths } = input;

  if (principal <= 0 || termMonths <= 0) {
    return { monthlyPayment: 0, totalRepayment: 0, totalInterest: 0 };
  }

  // 0% interest — simple equal division
  if (annualRatePercent === 0) {
    const monthlyPayment = Math.round((principal / termMonths) * 100) / 100;
    return {
      monthlyPayment,
      totalRepayment: Math.round(monthlyPayment * termMonths * 100) / 100,
      totalInterest: 0,
    };
  }

  const monthlyRate = annualRatePercent / 100 / 12;
  const compoundFactor = Math.pow(1 + monthlyRate, termMonths);
  const monthlyPayment =
    Math.round(
      ((principal * (monthlyRate * compoundFactor)) / (compoundFactor - 1)) * 100
    ) / 100;

  const totalRepayment = Math.round(monthlyPayment * termMonths * 100) / 100;
  const totalInterest = Math.round((totalRepayment - principal) * 100) / 100;

  return { monthlyPayment, totalRepayment, totalInterest };
}

/**
 * Get allowed repayment term options for a given credit tier.
 * Matches Fineract product configurations (loan-products.json).
 */
export function getAllowedTerms(tier: string): number[] {
  switch (tier) {
    case 'Tier 3':
      return [6, 12, 18];
    case 'Tier 2':
      return [6, 12];
    case 'Tier 1':
    default:
      return [6, 12];
  }
}
