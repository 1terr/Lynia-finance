/**
 * Loan Write-Off Service (Phase 8)
 *
 * Features:
 *  - Full and partial loan write-offs
 *  - Multi-step approval workflow (request -> approve/reject)
 *  - Accounting entry references (allowance method per GAAP)
 *  - Recovery tracking post-write-off
 *  - Credit bureau reporting flags
 *  - Auto write-off eligibility detection (180+ DPD)
 *  - Reversal capability for erroneous write-offs
 *  - Audit logging for all write-off operations
 */

import { db, query } from '../../shared/clients/database';
import logger from '../../shared/utils/logger';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

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

// ===================================================================
// WRITE-OFF REQUEST
// ===================================================================

/**
 * Request a loan write-off. Requires approval from manager for amounts
 * above the configured threshold.
 */
export async function requestWriteOff(
  request: WriteOffRequest,
  requestedBy: string
): Promise<LoanWriteOff> {
  // Fetch the loan
  const { data: loan } = await db
    .from('loans')
    .select('*')
    .eq('id', request.loan_id)
    .single()
    .execute();

  if (!loan) {
    throw new WriteOffError('Loan not found', 'WRITEOFF_LOAN_001');
  }

  // Validate loan status
  const validStatuses = ['active', 'defaulted', 'disbursed'];
  if (!validStatuses.includes(loan.status)) {
    throw new WriteOffError(
      `Cannot write off loan with status '${loan.status}'`,
      'WRITEOFF_STATUS_001'
    );
  }

  // Check if loan already has a pending or approved write-off
  const { data: existingWriteOffs } = await db
    .from('loan_write_offs')
    .select('id, status')
    .eq('loan_id', request.loan_id)
    .in('status', ['pending', 'approved'])
    .execute();

  if (existingWriteOffs && existingWriteOffs.length > 0) {
    throw new WriteOffError(
      'Loan already has a pending or approved write-off',
      'WRITEOFF_DUP_001'
    );
  }

  // Validate amounts
  const outstandingBalance = loan.outstanding_balance_usd || 0;
  const totalWriteOff =
    request.principal_written_off +
    (request.interest_written_off || 0) +
    (request.penalties_written_off || 0);

  if (totalWriteOff <= 0) {
    throw new WriteOffError('Write-off amount must be greater than zero', 'WRITEOFF_AMT_001');
  }

  if (totalWriteOff > outstandingBalance) {
    throw new WriteOffError(
      `Write-off amount ($${totalWriteOff}) exceeds outstanding balance ($${outstandingBalance})`,
      'WRITEOFF_AMT_002'
    );
  }

  if (request.write_off_type === 'full' && totalWriteOff < outstandingBalance) {
    throw new WriteOffError(
      'Full write-off must cover the entire outstanding balance',
      'WRITEOFF_AMT_003'
    );
  }

  const outstandingAfter = Math.round((outstandingBalance - totalWriteOff) * 100) / 100;

  // Generate accounting reference
  const accountingRef = generateAccountingReference(request.loan_id);

  const { data: writeOff, error } = await db
    .from('loan_write_offs')
    .insert({
      loan_id: request.loan_id,
      customer_id: loan.customer_id,
      write_off_type: request.write_off_type,
      write_off_reason: request.write_off_reason,
      reason_details: request.reason_details,
      principal_written_off: request.principal_written_off,
      interest_written_off: request.interest_written_off || 0,
      penalties_written_off: request.penalties_written_off || 0,
      total_written_off: totalWriteOff,
      outstanding_before: outstandingBalance,
      outstanding_after: outstandingAfter,
      recovery_expected: request.recovery_expected || false,
      recovered_amount_usd: 0,
      accounting_entry_ref: accountingRef,
      allowance_amount: totalWriteOff,
      status: 'pending',
      requested_by: requestedBy,
      requested_at: new Date().toISOString(),
      credit_bureau_reported: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .single()
    .execute();

  if (error || !writeOff) {
    throw new WriteOffError('Failed to create write-off request', 'WRITEOFF_CREATE_001');
  }

  await logAudit('writeoff.requested', 'loan_write_off', writeOff.id, requestedBy, {
    loan_id: request.loan_id,
    type: request.write_off_type,
    reason: request.write_off_reason,
    total_amount: totalWriteOff,
    outstanding_before: outstandingBalance,
  });

  return writeOff as LoanWriteOff;
}

// ===================================================================
// WRITE-OFF APPROVAL
// ===================================================================

/**
 * Approve a write-off request and apply it to the loan
 */
export async function approveWriteOff(
  writeOffId: string,
  approvedBy: string
): Promise<LoanWriteOff> {
  const { data: writeOff } = await db
    .from('loan_write_offs')
    .select('*')
    .eq('id', writeOffId)
    .single()
    .execute();

  if (!writeOff) {
    throw new WriteOffError('Write-off request not found', 'WRITEOFF_APPROVE_001');
  }

  if (writeOff.status !== 'pending') {
    throw new WriteOffError(
      `Cannot approve write-off with status '${writeOff.status}'`,
      'WRITEOFF_APPROVE_002'
    );
  }

  // Approver cannot be the requester
  if (writeOff.requested_by === approvedBy) {
    throw new WriteOffError(
      'Write-off cannot be approved by the requester',
      'WRITEOFF_APPROVE_003'
    );
  }

  // Update write-off status
  const { data: updated, error } = await db
    .from('loan_write_offs')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', writeOffId)
    .single()
    .execute();

  if (error || !updated) {
    throw new WriteOffError('Failed to approve write-off', 'WRITEOFF_APPROVE_004');
  }

  // Apply write-off to the loan
  const newOutstanding = writeOff.outstanding_after;
  const loanStatus = newOutstanding <= 0 ? 'defaulted' : writeOff.status;

  await query(
    `UPDATE loans SET
      outstanding_balance_usd = $1,
      written_off_amount_usd = COALESCE(written_off_amount_usd, 0) + $2,
      write_off_date = CASE WHEN $1 <= 0 THEN NOW() ELSE write_off_date END,
      status = CASE WHEN $1 <= 0 THEN 'defaulted' ELSE status END,
      updated_at = NOW()
    WHERE id = $3`,
    [newOutstanding, writeOff.total_written_off, writeOff.loan_id]
  );

  await logAudit('writeoff.approved', 'loan_write_off', writeOffId, approvedBy, {
    loan_id: writeOff.loan_id,
    total_written_off: writeOff.total_written_off,
    outstanding_after: newOutstanding,
    loan_status: loanStatus,
  });

  return updated as LoanWriteOff;
}

/**
 * Reject a write-off request
 */
export async function rejectWriteOff(
  writeOffId: string,
  rejectedBy: string,
  reason: string
): Promise<LoanWriteOff> {
  if (!reason || reason.trim().length < 5) {
    throw new WriteOffError(
      'Rejection reason must be at least 5 characters',
      'WRITEOFF_REJECT_001'
    );
  }

  const { data: writeOff } = await db
    .from('loan_write_offs')
    .select('*')
    .eq('id', writeOffId)
    .single()
    .execute();

  if (!writeOff) {
    throw new WriteOffError('Write-off request not found', 'WRITEOFF_REJECT_002');
  }

  if (writeOff.status !== 'pending') {
    throw new WriteOffError(
      `Cannot reject write-off with status '${writeOff.status}'`,
      'WRITEOFF_REJECT_003'
    );
  }

  const { data: updated, error } = await db
    .from('loan_write_offs')
    .update({
      status: 'rejected',
      approved_by: rejectedBy,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', writeOffId)
    .single()
    .execute();

  if (error || !updated) {
    throw new WriteOffError('Failed to reject write-off', 'WRITEOFF_REJECT_004');
  }

  await logAudit('writeoff.rejected', 'loan_write_off', writeOffId, rejectedBy, {
    loan_id: writeOff.loan_id,
    reason,
  });

  return updated as LoanWriteOff;
}

/**
 * Reverse a previously approved write-off
 */
export async function reverseWriteOff(
  writeOffId: string,
  reversedBy: string,
  reason: string
): Promise<LoanWriteOff> {
  if (!reason || reason.trim().length < 5) {
    throw new WriteOffError(
      'Reversal reason must be at least 5 characters',
      'WRITEOFF_REVERSE_001'
    );
  }

  const { data: writeOff } = await db
    .from('loan_write_offs')
    .select('*')
    .eq('id', writeOffId)
    .single()
    .execute();

  if (!writeOff) {
    throw new WriteOffError('Write-off not found', 'WRITEOFF_REVERSE_002');
  }

  if (writeOff.status !== 'approved') {
    throw new WriteOffError(
      `Cannot reverse write-off with status '${writeOff.status}'`,
      'WRITEOFF_REVERSE_003'
    );
  }

  // Update write-off status
  const { data: updated, error } = await db
    .from('loan_write_offs')
    .update({
      status: 'reversed',
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', writeOffId)
    .single()
    .execute();

  if (error || !updated) {
    throw new WriteOffError('Failed to reverse write-off', 'WRITEOFF_REVERSE_004');
  }

  // Restore loan balance
  await query(
    `UPDATE loans SET
      outstanding_balance_usd = COALESCE(outstanding_balance_usd, 0) + $1,
      written_off_amount_usd = GREATEST(COALESCE(written_off_amount_usd, 0) - $1, 0),
      status = CASE WHEN status = 'defaulted' THEN 'active' ELSE status END,
      write_off_date = NULL,
      updated_at = NOW()
    WHERE id = $2`,
    [writeOff.total_written_off, writeOff.loan_id]
  );

  await logAudit('writeoff.reversed', 'loan_write_off', writeOffId, reversedBy, {
    loan_id: writeOff.loan_id,
    amount_restored: writeOff.total_written_off,
    reason,
  });

  return updated as LoanWriteOff;
}

// ===================================================================
// WRITE-OFF QUERIES
// ===================================================================

/**
 * Get a single write-off by ID
 */
export async function getWriteOff(writeOffId: string): Promise<LoanWriteOff> {
  const { data, error } = await db
    .from('loan_write_offs')
    .select('*')
    .eq('id', writeOffId)
    .single()
    .execute();

  if (error || !data) {
    throw new WriteOffError('Write-off not found', 'WRITEOFF_FETCH_001');
  }

  return data as LoanWriteOff;
}

/**
 * Get write-offs for a loan
 */
export async function getLoanWriteOffs(loanId: string): Promise<LoanWriteOff[]> {
  const { data, error } = await db
    .from('loan_write_offs')
    .select('*')
    .eq('loan_id', loanId)
    .order('created_at', { ascending: false })
    .execute();

  if (error) {
    throw new WriteOffError('Failed to fetch write-offs', 'WRITEOFF_FETCH_002');
  }

  return (data || []) as LoanWriteOff[];
}

/**
 * Get pending write-off requests (for approval queue)
 */
export async function getPendingWriteOffs(): Promise<LoanWriteOff[]> {
  const { data, error } = await db
    .from('loan_write_offs')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .execute();

  if (error) {
    throw new WriteOffError('Failed to fetch pending write-offs', 'WRITEOFF_FETCH_003');
  }

  return (data || []) as LoanWriteOff[];
}

/**
 * Get write-off summary/stats
 */
export async function getWriteOffSummary(): Promise<WriteOffSummary> {
  const { data } = await query<{
    total_write_offs: string;
    total_principal: string;
    total_interest: string;
    total_penalties: string;
    total_recovered: string;
    write_off_count: string;
    pending_count: string;
  }>(
    `SELECT
      COALESCE(SUM(CASE WHEN status = 'approved' THEN total_written_off ELSE 0 END), 0) as total_write_offs,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN principal_written_off ELSE 0 END), 0) as total_principal,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN interest_written_off ELSE 0 END), 0) as total_interest,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN penalties_written_off ELSE 0 END), 0) as total_penalties,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN recovered_amount_usd ELSE 0 END), 0) as total_recovered,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as write_off_count,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
    FROM loan_write_offs`
  );

  const row = data[0];
  const totalWriteOffs = parseFloat(row?.total_write_offs || '0');
  const totalRecovered = parseFloat(row?.total_recovered || '0');

  return {
    total_write_offs: totalWriteOffs,
    total_principal_written_off: parseFloat(row?.total_principal || '0'),
    total_interest_written_off: parseFloat(row?.total_interest || '0'),
    total_penalties_written_off: parseFloat(row?.total_penalties || '0'),
    total_recovered: totalRecovered,
    net_loss: totalWriteOffs - totalRecovered,
    write_off_count: parseInt(row?.write_off_count || '0'),
    pending_count: parseInt(row?.pending_count || '0'),
  };
}

// ===================================================================
// AUTO WRITE-OFF ELIGIBILITY
// ===================================================================

/**
 * Check if a loan is eligible for auto write-off (180+ DPD default)
 */
export async function checkWriteOffEligibility(
  loanId: string
): Promise<WriteOffEligibility> {
  const { data: loan } = await db
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single()
    .execute();

  if (!loan) {
    throw new WriteOffError('Loan not found', 'WRITEOFF_ELIG_001');
  }

  // Check if already written off
  const { data: existing } = await db
    .from('loan_write_offs')
    .select('id')
    .eq('loan_id', loanId)
    .in('status', ['pending', 'approved'])
    .execute();

  const alreadyWrittenOff = (existing && existing.length > 0) || false;

  // Fetch auto write-off threshold from config
  const { data: configRows } = await db
    .from('system_config')
    .select('value')
    .eq('key', 'auto_write_off_days')
    .single()
    .execute();

  const autoWriteOffDays = parseInt(configRows?.value || '180');
  const daysPastDue = loan.days_past_due || 0;
  const outstandingBalance = loan.outstanding_balance_usd || 0;

  if (alreadyWrittenOff) {
    return {
      eligible: false,
      loan_id: loanId,
      days_past_due: daysPastDue,
      outstanding_balance: outstandingBalance,
      reason: 'Loan already has a pending or approved write-off',
      suggested_type: 'full',
      already_written_off: true,
    };
  }

  if (outstandingBalance <= 0) {
    return {
      eligible: false,
      loan_id: loanId,
      days_past_due: daysPastDue,
      outstanding_balance: outstandingBalance,
      reason: 'No outstanding balance to write off',
      suggested_type: 'full',
      already_written_off: false,
    };
  }

  if (daysPastDue < autoWriteOffDays) {
    return {
      eligible: false,
      loan_id: loanId,
      days_past_due: daysPastDue,
      outstanding_balance: outstandingBalance,
      reason: `Loan is ${daysPastDue} days past due (threshold: ${autoWriteOffDays} days)`,
      suggested_type: 'full',
      already_written_off: false,
    };
  }

  return {
    eligible: true,
    loan_id: loanId,
    days_past_due: daysPastDue,
    outstanding_balance: outstandingBalance,
    suggested_type: 'full',
    already_written_off: false,
  };
}

/**
 * Record a recovery amount against a written-off loan
 */
export async function recordRecovery(
  writeOffId: string,
  amount: number,
  notes: string,
  recordedBy: string
): Promise<LoanWriteOff> {
  if (amount <= 0) {
    throw new WriteOffError('Recovery amount must be positive', 'WRITEOFF_RECOVERY_001');
  }

  const { data: writeOff } = await db
    .from('loan_write_offs')
    .select('*')
    .eq('id', writeOffId)
    .single()
    .execute();

  if (!writeOff) {
    throw new WriteOffError('Write-off not found', 'WRITEOFF_RECOVERY_002');
  }

  if (writeOff.status !== 'approved') {
    throw new WriteOffError(
      'Can only record recovery against approved write-offs',
      'WRITEOFF_RECOVERY_003'
    );
  }

  const newRecoveredAmount = (writeOff.recovered_amount_usd || 0) + amount;
  if (newRecoveredAmount > writeOff.total_written_off) {
    throw new WriteOffError(
      `Recovery total ($${newRecoveredAmount}) would exceed written-off amount ($${writeOff.total_written_off})`,
      'WRITEOFF_RECOVERY_004'
    );
  }

  const existingNotes = writeOff.recovery_notes || '';
  const timestamp = new Date().toISOString();
  const newNotes = existingNotes
    ? `${existingNotes}\n[${timestamp}] Recovered $${amount}: ${notes}`
    : `[${timestamp}] Recovered $${amount}: ${notes}`;

  const { data: updated, error } = await db
    .from('loan_write_offs')
    .update({
      recovered_amount_usd: newRecoveredAmount,
      recovery_notes: newNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', writeOffId)
    .single()
    .execute();

  if (error || !updated) {
    throw new WriteOffError('Failed to record recovery', 'WRITEOFF_RECOVERY_005');
  }

  await logAudit('writeoff.recovery', 'loan_write_off', writeOffId, recordedBy, {
    loan_id: writeOff.loan_id,
    recovery_amount: amount,
    total_recovered: newRecoveredAmount,
    notes,
  });

  return updated as LoanWriteOff;
}

// ===================================================================
// INTERNAL HELPERS
// ===================================================================

function generateAccountingReference(loanId: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WO-${dateStr}-${loanId.slice(0, 8)}-${random}`;
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
    logger.error('Failed to write audit log', { action: 'writeoff.audit', meta: { auditAction: action, entityType, entityId } });
  }
}

// ===================================================================
// ERROR CLASS
// ===================================================================

export class WriteOffError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'WriteOffError';
  }
}
