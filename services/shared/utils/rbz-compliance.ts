/**
 * RBZ Compliance Validation
 *
 * Validates loan product parameters against Reserve Bank of Zimbabwe
 * regulatory ceilings and internal policy caps before product creation
 * or update. Prevents non-compliant products from being synced to Fineract.
 */

import {
  RBZ_RATE_CEILING,
  LARGE_TRANSACTION_THRESHOLD_USD,
} from '../rbz-reporting/helpers';

// ===================================================================
// INTERNAL POLICY CAPS
// ===================================================================

/** Maximum insurance fee percentage (internal policy) */
const MAX_INSURANCE_FEE_PERCENTAGE = 20;

/** Maximum late penalty percentage (internal policy) */
const MAX_LATE_PENALTY_PERCENTAGE = 10;

// ===================================================================
// TYPES
// ===================================================================

export interface RBZComplianceViolation {
  field: string;
  value: number;
  limit: number;
  message: string;
}

export interface RBZComplianceResult {
  compliant: boolean;
  violations: RBZComplianceViolation[];
}

export interface ProductComplianceInput {
  interest_rate_annual?: number;
  effective_apr?: number;
  max_amount_usd?: number;
  insurance_fee_percentage?: number;
  late_penalty_percentage?: number;
}

// ===================================================================
// VALIDATION
// ===================================================================

/**
 * Validate a loan product against RBZ regulatory ceilings and internal
 * policy caps.
 *
 * Checks:
 * - interest_rate_annual <= RBZ_RATE_CEILING (100%)
 * - effective_apr <= RBZ_RATE_CEILING (100%)
 * - max_amount_usd <= LARGE_TRANSACTION_THRESHOLD_USD ($2,000)
 * - insurance_fee_percentage <= 20% (internal policy cap)
 * - late_penalty_percentage <= 10% (internal policy cap)
 *
 * @param product - Product fields to validate
 * @returns Compliance result with any violations found
 */
export function validateRBZCompliance(product: ProductComplianceInput): RBZComplianceResult {
  const violations: RBZComplianceViolation[] = [];

  if (
    product.interest_rate_annual != null &&
    product.interest_rate_annual > RBZ_RATE_CEILING
  ) {
    violations.push({
      field: 'interest_rate_annual',
      value: product.interest_rate_annual,
      limit: RBZ_RATE_CEILING,
      message: `Annual interest rate ${product.interest_rate_annual}% exceeds RBZ ceiling of ${RBZ_RATE_CEILING}%`,
    });
  }

  if (
    product.effective_apr != null &&
    product.effective_apr > RBZ_RATE_CEILING
  ) {
    violations.push({
      field: 'effective_apr',
      value: product.effective_apr,
      limit: RBZ_RATE_CEILING,
      message: `Effective APR ${product.effective_apr}% exceeds RBZ ceiling of ${RBZ_RATE_CEILING}%`,
    });
  }

  if (
    product.max_amount_usd != null &&
    product.max_amount_usd > LARGE_TRANSACTION_THRESHOLD_USD
  ) {
    violations.push({
      field: 'max_amount_usd',
      value: product.max_amount_usd,
      limit: LARGE_TRANSACTION_THRESHOLD_USD,
      message: `Maximum amount $${product.max_amount_usd} exceeds RBZ threshold of $${LARGE_TRANSACTION_THRESHOLD_USD}`,
    });
  }

  if (
    product.insurance_fee_percentage != null &&
    product.insurance_fee_percentage > MAX_INSURANCE_FEE_PERCENTAGE
  ) {
    violations.push({
      field: 'insurance_fee_percentage',
      value: product.insurance_fee_percentage,
      limit: MAX_INSURANCE_FEE_PERCENTAGE,
      message: `Insurance fee ${product.insurance_fee_percentage}% exceeds policy cap of ${MAX_INSURANCE_FEE_PERCENTAGE}%`,
    });
  }

  if (
    product.late_penalty_percentage != null &&
    product.late_penalty_percentage > MAX_LATE_PENALTY_PERCENTAGE
  ) {
    violations.push({
      field: 'late_penalty_percentage',
      value: product.late_penalty_percentage,
      limit: MAX_LATE_PENALTY_PERCENTAGE,
      message: `Late penalty ${product.late_penalty_percentage}% exceeds policy cap of ${MAX_LATE_PENALTY_PERCENTAGE}%`,
    });
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}
