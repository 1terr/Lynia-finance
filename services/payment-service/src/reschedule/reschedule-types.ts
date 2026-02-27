/**
 * Reschedule Type Definitions
 *
 * All type/interface definitions for the reschedule service.
 */

export type RescheduleType =
  | 'term_extension'
  | 'rate_reduction'
  | 'payment_holiday'
  | 'balance_restructure'
  | 'combined';

export type RescheduleReason =
  | 'hardship'
  | 'natural_disaster'
  | 'medical'
  | 'job_loss'
  | 'business_failure'
  | 'other';

export type RescheduleStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface RescheduleRequest {
  loan_id: string;
  reschedule_type: RescheduleType;
  reason: RescheduleReason;
  reason_details?: string;
  new_term_months?: number;
  new_interest_rate?: number;
  holiday_months?: number;
  holiday_start_date?: string;
  conditions?: Record<string, unknown>;
  staff_notes?: string;
}

export interface LoanReschedule {
  id: string;
  loan_id: string;
  customer_id: string;
  reschedule_type: RescheduleType;
  reason: RescheduleReason;
  original_term_months: number;
  original_interest_rate: number;
  original_monthly_amount: number;
  original_maturity_date?: string;
  original_outstanding: number;
  new_term_months: number;
  new_interest_rate: number;
  new_monthly_amount: number;
  new_maturity_date?: string;
  new_outstanding: number;
  holiday_start_date?: string;
  holiday_end_date?: string;
  holiday_months?: number;
  conditions?: Record<string, unknown>;
  staff_notes?: string;
  customer_acknowledgement: boolean;
  status: RescheduleStatus;
  requested_by: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  activated_at?: string;
  completed_at?: string;
  rejection_reason?: string;
  reschedule_count: number;
  created_at: string;
}

export class RescheduleError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'RescheduleError';
  }
}
