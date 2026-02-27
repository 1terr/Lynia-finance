/**
 * Write-Off Type Definitions
 *
 * All type/interface definitions for the write-off service.
 */

export type WriteOffType = 'full' | 'partial';
export type WriteOffReason = 'default_180' | 'uncollectable' | 'fraud' | 'deceased' | 'settlement';
export type WriteOffStatus = 'pending' | 'approved' | 'rejected' | 'reversed';

export interface WriteOffRequest {
  loan_id: string;
  write_off_type: WriteOffType;
  write_off_reason: WriteOffReason;
  reason_details?: string;
  principal_written_off: number;
  interest_written_off?: number;
  penalties_written_off?: number;
  recovery_expected?: boolean;
  staff_notes?: string;
}

export interface LoanWriteOff {
  id: string;
  loan_id: string;
  customer_id: string;
  write_off_type: WriteOffType;
  write_off_reason: WriteOffReason;
  reason_details?: string;
  principal_written_off: number;
  interest_written_off: number;
  penalties_written_off: number;
  total_written_off: number;
  outstanding_before: number;
  outstanding_after: number;
  recovery_expected: boolean;
  recovered_amount_usd: number;
  accounting_entry_ref?: string;
  allowance_amount?: number;
  status: WriteOffStatus;
  requested_by: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  credit_bureau_reported: boolean;
  created_at: string;
}

export interface WriteOffSummary {
  total_write_offs: number;
  total_principal_written_off: number;
  total_interest_written_off: number;
  total_penalties_written_off: number;
  total_recovered: number;
  net_loss: number;
  write_off_count: number;
  pending_count: number;
}

export interface WriteOffEligibility {
  eligible: boolean;
  loan_id: string;
  days_past_due: number;
  outstanding_balance: number;
  reason?: string;
  suggested_type: WriteOffType;
  already_written_off: boolean;
}

export class WriteOffError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'WriteOffError';
  }
}
