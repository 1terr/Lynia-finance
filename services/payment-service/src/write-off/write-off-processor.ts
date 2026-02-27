/**
 * Write-Off Processor Module
 *
 * Write-off execution, approval, rejection, and reversal workflows.
 */

import { db, query } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';
import type {
  WriteOffRequest,
  LoanWriteOff,
} from './write-off-types';
import { WriteOffError } from './write-off-types';

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
