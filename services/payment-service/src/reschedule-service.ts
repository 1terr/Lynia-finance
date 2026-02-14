/**
 * Enhanced Loan Rescheduling Service (Phase 8)
 *
 * Builds upon the Phase 3 restructuring-service with:
 *  - Full audit trail with before/after term snapshots
 *  - Multi-step approval workflow
 *  - Configurable max reschedule limits
 *  - Combined rescheduling (rate + term in one request)
 *  - Payment holiday tracking with start/end dates
 *  - Customer acknowledgement workflow
 *  - Reschedule count enforcement per loan
 *  - Balance restructuring for hardship cases
 */

import { db, query } from '../../shared/clients/database';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

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

// ===================================================================
// RESCHEDULE REQUEST
// ===================================================================

/**
 * Request a loan reschedule with full term snapshot
 */
export async function requestReschedule(
  request: RescheduleRequest,
  requestedBy: string
): Promise<LoanReschedule> {
  // Validate request type
  const validTypes: RescheduleType[] = [
    'term_extension', 'rate_reduction', 'payment_holiday', 'balance_restructure', 'combined'
  ];
  if (!validTypes.includes(request.reschedule_type)) {
    throw new RescheduleError(
      `Invalid reschedule type: ${request.reschedule_type}`,
      'RESCHED_TYPE_001'
    );
  }

  const validReasons: RescheduleReason[] = [
    'hardship', 'natural_disaster', 'medical', 'job_loss', 'business_failure', 'other'
  ];
  if (!validReasons.includes(request.reason)) {
    throw new RescheduleError(
      `Invalid reason: ${request.reason}`,
      'RESCHED_REASON_001'
    );
  }

  // Fetch loan
  const { data: loan } = await db
    .from('loans')
    .select('*')
    .eq('id', request.loan_id)
    .single()
    .execute();

  if (!loan) {
    throw new RescheduleError('Loan not found', 'RESCHED_LOAN_001');
  }

  // Only active or disbursed loans can be rescheduled
  if (!['active', 'disbursed'].includes(loan.status)) {
    throw new RescheduleError(
      `Cannot reschedule loan with status '${loan.status}'`,
      'RESCHED_STATUS_001'
    );
  }

  // Check reschedule count limit
  const maxReschedules = await getMaxReschedules();
  const currentCount = loan.reschedule_count || 0;

  if (currentCount >= maxReschedules) {
    throw new RescheduleError(
      `Maximum reschedule limit reached (${maxReschedules})`,
      'RESCHED_LIMIT_001'
    );
  }

  // Check no pending reschedule exists
  const { data: pending } = await db
    .from('loan_reschedules')
    .select('id')
    .eq('loan_id', request.loan_id)
    .in('status', ['pending', 'approved', 'active'])
    .execute();

  if (pending && pending.length > 0) {
    throw new RescheduleError(
      'Loan already has a pending or active reschedule',
      'RESCHED_DUP_001'
    );
  }

  // Snapshot current terms
  const originalTerms = {
    term_months: loan.loan_term_months || 6,
    interest_rate: loan.interest_rate || 12,
    monthly_amount: loan.next_payment_amount_usd || loan.monthly_installment_usd || 0,
    maturity_date: loan.maturity_date,
    outstanding: loan.outstanding_balance_usd || 0,
  };

  // Compute new terms based on reschedule type
  const newTerms = computeNewTerms(request, originalTerms);

  // Calculate new maturity date
  const newMaturityDate = calculateMaturityDate(
    loan.disbursed_at || loan.created_at,
    newTerms.term_months
  );

  const { data: reschedule, error } = await db
    .from('loan_reschedules')
    .insert({
      loan_id: request.loan_id,
      customer_id: loan.customer_id,
      reschedule_type: request.reschedule_type,
      reason: request.reason,
      original_term_months: originalTerms.term_months,
      original_interest_rate: originalTerms.interest_rate,
      original_monthly_amount: originalTerms.monthly_amount,
      original_maturity_date: originalTerms.maturity_date,
      original_outstanding: originalTerms.outstanding,
      new_term_months: newTerms.term_months,
      new_interest_rate: newTerms.interest_rate,
      new_monthly_amount: newTerms.monthly_amount,
      new_maturity_date: newMaturityDate,
      new_outstanding: newTerms.outstanding,
      holiday_start_date: request.holiday_start_date || null,
      holiday_end_date: request.holiday_months && request.holiday_start_date
        ? calculateHolidayEndDate(request.holiday_start_date, request.holiday_months)
        : null,
      holiday_months: request.holiday_months || null,
      conditions: request.conditions ? JSON.stringify(request.conditions) : null,
      staff_notes: request.staff_notes,
      customer_acknowledgement: false,
      status: 'pending',
      requested_by: requestedBy,
      requested_at: new Date().toISOString(),
      reschedule_count: currentCount + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .single()
    .execute();

  if (error || !reschedule) {
    throw new RescheduleError('Failed to create reschedule request', 'RESCHED_CREATE_001');
  }

  await logAudit('reschedule.requested', 'loan_reschedule', reschedule.id, requestedBy, {
    loan_id: request.loan_id,
    type: request.reschedule_type,
    reason: request.reason,
    original_monthly: originalTerms.monthly_amount,
    new_monthly: newTerms.monthly_amount,
    original_term: originalTerms.term_months,
    new_term: newTerms.term_months,
  });

  return reschedule as LoanReschedule;
}

// ===================================================================
// RESCHEDULE APPROVAL WORKFLOW
// ===================================================================

/**
 * Approve a reschedule request and apply new terms to the loan
 */
export async function approveReschedule(
  rescheduleId: string,
  approvedBy: string
): Promise<LoanReschedule> {
  const { data: reschedule } = await db
    .from('loan_reschedules')
    .select('*')
    .eq('id', rescheduleId)
    .single()
    .execute();

  if (!reschedule) {
    throw new RescheduleError('Reschedule request not found', 'RESCHED_APPROVE_001');
  }

  if (reschedule.status !== 'pending') {
    throw new RescheduleError(
      `Cannot approve reschedule with status '${reschedule.status}'`,
      'RESCHED_APPROVE_002'
    );
  }

  // Update reschedule status
  const { data: updated, error } = await db
    .from('loan_reschedules')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', rescheduleId)
    .single()
    .execute();

  if (error || !updated) {
    throw new RescheduleError('Failed to approve reschedule', 'RESCHED_APPROVE_003');
  }

  await logAudit('reschedule.approved', 'loan_reschedule', rescheduleId, approvedBy, {
    loan_id: reschedule.loan_id,
    type: reschedule.reschedule_type,
  });

  return updated as LoanReschedule;
}

/**
 * Activate an approved reschedule (apply new terms to the loan)
 */
export async function activateReschedule(
  rescheduleId: string,
  activatedBy: string
): Promise<LoanReschedule> {
  const { data: reschedule } = await db
    .from('loan_reschedules')
    .select('*')
    .eq('id', rescheduleId)
    .single()
    .execute();

  if (!reschedule) {
    throw new RescheduleError('Reschedule not found', 'RESCHED_ACTIVATE_001');
  }

  if (reschedule.status !== 'approved') {
    throw new RescheduleError(
      `Cannot activate reschedule with status '${reschedule.status}'`,
      'RESCHED_ACTIVATE_002'
    );
  }

  // Apply new terms to the loan
  await query(
    `UPDATE loans SET
      loan_term_months = $1,
      interest_rate = $2,
      next_payment_amount_usd = $3,
      outstanding_balance_usd = $4,
      maturity_date = $5,
      reschedule_count = COALESCE(reschedule_count, 0) + 1,
      last_rescheduled_at = NOW(),
      updated_at = NOW()
    WHERE id = $6`,
    [
      reschedule.new_term_months,
      reschedule.new_interest_rate,
      reschedule.new_monthly_amount,
      reschedule.new_outstanding,
      reschedule.new_maturity_date,
      reschedule.loan_id,
    ]
  );

  // Update reschedule status to active
  const { data: activated, error } = await db
    .from('loan_reschedules')
    .update({
      status: 'active',
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', rescheduleId)
    .single()
    .execute();

  if (error || !activated) {
    throw new RescheduleError('Failed to activate reschedule', 'RESCHED_ACTIVATE_003');
  }

  await logAudit('reschedule.activated', 'loan_reschedule', rescheduleId, activatedBy, {
    loan_id: reschedule.loan_id,
    new_term_months: reschedule.new_term_months,
    new_interest_rate: reschedule.new_interest_rate,
    new_monthly_amount: reschedule.new_monthly_amount,
  });

  return activated as LoanReschedule;
}

/**
 * Reject a reschedule request
 */
export async function rejectReschedule(
  rescheduleId: string,
  rejectedBy: string,
  reason: string
): Promise<LoanReschedule> {
  if (!reason || reason.trim().length < 5) {
    throw new RescheduleError(
      'Rejection reason must be at least 5 characters',
      'RESCHED_REJECT_001'
    );
  }

  const { data: reschedule } = await db
    .from('loan_reschedules')
    .select('*')
    .eq('id', rescheduleId)
    .single()
    .execute();

  if (!reschedule) {
    throw new RescheduleError('Reschedule not found', 'RESCHED_REJECT_002');
  }

  if (reschedule.status !== 'pending') {
    throw new RescheduleError(
      `Cannot reject reschedule with status '${reschedule.status}'`,
      'RESCHED_REJECT_003'
    );
  }

  const { data: updated, error } = await db
    .from('loan_reschedules')
    .update({
      status: 'rejected',
      approved_by: rejectedBy,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rescheduleId)
    .single()
    .execute();

  if (error || !updated) {
    throw new RescheduleError('Failed to reject reschedule', 'RESCHED_REJECT_004');
  }

  await logAudit('reschedule.rejected', 'loan_reschedule', rescheduleId, rejectedBy, {
    loan_id: reschedule.loan_id,
    reason,
  });

  return updated as LoanReschedule;
}

/**
 * Cancel a pending reschedule (requester can cancel their own request)
 */
export async function cancelReschedule(
  rescheduleId: string,
  cancelledBy: string
): Promise<LoanReschedule> {
  const { data: reschedule } = await db
    .from('loan_reschedules')
    .select('*')
    .eq('id', rescheduleId)
    .single()
    .execute();

  if (!reschedule) {
    throw new RescheduleError('Reschedule not found', 'RESCHED_CANCEL_001');
  }

  if (reschedule.status !== 'pending') {
    throw new RescheduleError(
      `Cannot cancel reschedule with status '${reschedule.status}'`,
      'RESCHED_CANCEL_002'
    );
  }

  const { data: updated, error } = await db
    .from('loan_reschedules')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', rescheduleId)
    .single()
    .execute();

  if (error || !updated) {
    throw new RescheduleError('Failed to cancel reschedule', 'RESCHED_CANCEL_003');
  }

  await logAudit('reschedule.cancelled', 'loan_reschedule', rescheduleId, cancelledBy, {
    loan_id: reschedule.loan_id,
  });

  return updated as LoanReschedule;
}

/**
 * Record customer acknowledgement of rescheduled terms
 */
export async function acknowledgeReschedule(
  rescheduleId: string
): Promise<LoanReschedule> {
  const { data: updated, error } = await db
    .from('loan_reschedules')
    .update({
      customer_acknowledgement: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rescheduleId)
    .single()
    .execute();

  if (error || !updated) {
    throw new RescheduleError('Failed to acknowledge reschedule', 'RESCHED_ACK_001');
  }

  return updated as LoanReschedule;
}

// ===================================================================
// RESCHEDULE QUERIES
// ===================================================================

/**
 * Get a reschedule by ID
 */
export async function getReschedule(rescheduleId: string): Promise<LoanReschedule> {
  const { data, error } = await db
    .from('loan_reschedules')
    .select('*')
    .eq('id', rescheduleId)
    .single()
    .execute();

  if (error || !data) {
    throw new RescheduleError('Reschedule not found', 'RESCHED_FETCH_001');
  }

  return data as LoanReschedule;
}

/**
 * Get all reschedules for a loan
 */
export async function getLoanReschedules(loanId: string): Promise<LoanReschedule[]> {
  const { data, error } = await db
    .from('loan_reschedules')
    .select('*')
    .eq('loan_id', loanId)
    .order('created_at', { ascending: false })
    .execute();

  if (error) {
    throw new RescheduleError('Failed to fetch reschedules', 'RESCHED_FETCH_002');
  }

  return (data || []) as LoanReschedule[];
}

/**
 * Get pending reschedule requests (approval queue)
 */
export async function getPendingReschedules(): Promise<LoanReschedule[]> {
  const { data, error } = await db
    .from('loan_reschedules')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .execute();

  if (error) {
    throw new RescheduleError('Failed to fetch pending reschedules', 'RESCHED_FETCH_003');
  }

  return (data || []) as LoanReschedule[];
}

// ===================================================================
// INTERNAL HELPERS
// ===================================================================

interface OriginalTerms {
  term_months: number;
  interest_rate: number;
  monthly_amount: number;
  outstanding: number;
}

interface NewTerms {
  term_months: number;
  interest_rate: number;
  monthly_amount: number;
  outstanding: number;
}

function computeNewTerms(
  request: RescheduleRequest,
  original: OriginalTerms
): NewTerms {
  let newTermMonths = original.term_months;
  let newInterestRate = original.interest_rate;
  let newOutstanding = original.outstanding;

  switch (request.reschedule_type) {
    case 'term_extension': {
      const additionalMonths = (request.new_term_months || original.term_months + 3) - original.term_months;
      if (additionalMonths <= 0 || additionalMonths > 6) {
        throw new RescheduleError(
          'Term extension must be between 1-6 additional months',
          'RESCHED_TERM_001'
        );
      }
      newTermMonths = original.term_months + additionalMonths;
      break;
    }

    case 'rate_reduction': {
      const newRate = request.new_interest_rate;
      if (newRate === undefined || newRate >= original.interest_rate) {
        throw new RescheduleError(
          'New interest rate must be lower than current rate',
          'RESCHED_RATE_001'
        );
      }
      if (newRate < 0) {
        throw new RescheduleError('Interest rate cannot be negative', 'RESCHED_RATE_002');
      }
      newInterestRate = newRate;
      break;
    }

    case 'payment_holiday': {
      const holidayMonths = request.holiday_months || 1;
      if (holidayMonths < 1 || holidayMonths > 3) {
        throw new RescheduleError(
          'Payment holiday must be 1-3 months',
          'RESCHED_HOLIDAY_001'
        );
      }
      newTermMonths = original.term_months + holidayMonths;
      break;
    }

    case 'balance_restructure': {
      // For hardship: reduce outstanding by agreed settlement amount
      // The outstanding stays the same but terms are adjusted
      newTermMonths = request.new_term_months || original.term_months + 3;
      newInterestRate = request.new_interest_rate ?? 0; // 0% during hardship
      break;
    }

    case 'combined': {
      if (request.new_term_months) {
        newTermMonths = request.new_term_months;
      }
      if (request.new_interest_rate !== undefined) {
        newInterestRate = request.new_interest_rate;
      }
      if (request.holiday_months) {
        newTermMonths += request.holiday_months;
      }
      break;
    }
  }

  // Calculate new monthly amount
  const remainingMonths = newTermMonths - (original.term_months - Math.ceil(original.outstanding / (original.monthly_amount || 1)));
  const effectiveMonths = Math.max(remainingMonths, 1);
  const newMonthlyAmount = Math.round((newOutstanding / effectiveMonths) * 100) / 100;

  return {
    term_months: newTermMonths,
    interest_rate: newInterestRate,
    monthly_amount: newMonthlyAmount,
    outstanding: newOutstanding,
  };
}

function calculateMaturityDate(startDate: string, termMonths: number): string {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + termMonths);
  return date.toISOString().slice(0, 10);
}

function calculateHolidayEndDate(startDate: string, months: number): string {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

async function getMaxReschedules(): Promise<number> {
  const { data } = await db
    .from('system_config')
    .select('value')
    .eq('key', 'max_reschedules_per_loan')
    .single()
    .execute();

  return parseInt(data?.value || '3');
}

async function logAudit(
  action: string,
  entityType: string,
  entityId: string,
  performedBy: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await db.from('audit_log').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      performed_by: performedBy,
      metadata: JSON.stringify(metadata),
      created_at: new Date().toISOString(),
    }).execute();
  } catch {
    console.error('Failed to write audit log', { action, entityType, entityId });
  }
}

// ===================================================================
// ERROR CLASS
// ===================================================================

export class RescheduleError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'RescheduleError';
  }
}
