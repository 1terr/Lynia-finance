/**
 * Penalty Module - Barrel Re-exports
 *
 * Re-exports all penalty types, calculator functions, and error class
 * from their respective modules for a single import path.
 */

export {
  type PenaltyType,
  type CalculationMethod,
  type PenaltyRecurrence,
  type PenaltyStatus,
  type TieredConfig,
  type PenaltyConfiguration,
  type LoanPenalty,
  type PenaltyCalculationResult,
  type ApplyPenaltyResult,
  PenaltyError,
} from './penalty-types';

export {
  createPenaltyConfiguration,
  updatePenaltyConfiguration,
  getActivePenaltyConfigurations,
  getPenaltyConfiguration,
  calculatePenalties,
  applyPenalties,
  waivePenalty,
  getLoanPenalties,
  getLoanPenaltySummary,
  computeAmount,
  getApplicationCount,
  checkRecurrenceEligibility,
  validatePenaltyConfig,
} from './penalty-calculator';
