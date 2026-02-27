/**
 * Write-Off Eligibility Module
 *
 * Eligibility checks, auto-detection, and recovery tracking.
 */

import { db, query } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';
import type {
  LoanWriteOff,
  WriteOffSummary,
  WriteOffEligibility,
} from './write-off-types';
import { WriteOffError } from './write-off-types';

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
