/**
 * Reschedule Processor Module
 *
 * Workflow processing: create, approve, reject, activate, cancel,
 * acknowledge, and query reschedule requests.
 */

import { db, query } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';
import type {
  RescheduleType,
  RescheduleReason,
  RescheduleRequest,
  LoanReschedule,
} from './reschedule-types';
import { RescheduleError } from './reschedule-types';
import { computeNewTerms, calculateMaturityDate, calculateHolidayEndDate } from './reschedule-calculator';

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
    logger.error('Failed to write audit log', { action: 'reschedule.audit', meta: { auditAction: action, entityType, entityId } });
  }
}
