/**
 * Penalty Type Definitions
 *
 * All type/interface definitions for the penalty service.
 */

export type PenaltyType = 'late_fee' | 'penalty_interest' | 'collection_fee';
export type CalculationMethod = 'flat' | 'percentage' | 'tiered';
export type PenaltyRecurrence = 'once' | 'daily' | 'weekly' | 'monthly';
export type PenaltyStatus = 'applied' | 'paid' | 'waived' | 'reversed';

export interface TieredConfig {
  min_days: number;
  max_days: number | null;
  flat_amount?: number;
  percentage?: number;
}

export interface PenaltyConfiguration {
  id: string;
  product_id: string | null;
  penalty_type: PenaltyType;
  name: string;
  description?: string;
  calculation_method: CalculationMethod;
  flat_amount_usd?: number;
  percentage_rate?: number;
  tiered_config?: TieredConfig[];
  grace_period_days: number;
  min_days_past_due: number;
  max_days_past_due?: number;
  recurrence: PenaltyRecurrence;
  max_applications?: number;
  max_penalty_amount_usd?: number;
  max_total_penalties_usd?: number;
  max_penalty_percentage?: number;
  is_active: boolean;
  effective_from: string;
  effective_until?: string;
}

export interface LoanPenalty {
  id: string;
  loan_id: string;
  customer_id: string;
  penalty_config_id?: string;
  penalty_type: PenaltyType;
  amount_usd: number;
  currency: string;
  days_past_due_at_application: number;
  outstanding_balance_at_application: number;
  calculation_details?: Record<string, unknown>;
  status: PenaltyStatus;
  waived_by?: string;
  waived_at?: string;
  waiver_reason?: string;
  paid_at?: string;
  payment_id?: string;
  applied_by: string;
  created_at: string;
}

export interface PenaltyCalculationResult {
  amount: number;
  penalty_type: PenaltyType;
  config_id: string;
  calculation_method: CalculationMethod;
  details: Record<string, unknown>;
  capped: boolean;
  cap_reason?: string;
}

export interface ApplyPenaltyResult {
  penalties_applied: LoanPenalty[];
  total_amount: number;
  skipped_reasons: string[];
}

export class PenaltyError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'PenaltyError';
  }
}
