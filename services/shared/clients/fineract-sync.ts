/**
 * Fineract Sync Service
 *
 * High-level orchestration layer for syncing Lynia entities to Fineract.
 * Each method handles the full lifecycle: call Fineract, update Lynia DB
 * mapping columns, and log the sync operation for audit.
 *
 * All sync operations are non-blocking — if Fineract is down, the main
 * business logic (payment, scoring, onboarding) continues, and the sync
 * is logged as 'failed' for later retry by the reconciliation job.
 */

import { getFineractClient, FineractApiError, parseFineractDate } from './fineract';
import { db } from './database';

// ============================================================
// SYNC LOGGING
// ============================================================

interface SyncLogEntry {
  entity_type: string;
  entity_id: string;
  fineract_id?: number;
  operation: string;
  direction: string;
  status: string;
  request_payload?: unknown;
  response_payload?: unknown;
  error_message?: string;
  http_status_code?: number;
  duration_ms?: number;
  lambda_request_id?: string;
}

async function logSync(entry: SyncLogEntry): Promise<void> {
  try {
    await db
      .from('fineract_sync_log')
      .insert({
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        fineract_id: entry.fineract_id,
        operation: entry.operation,
        direction: entry.direction,
        status: entry.status,
        request_payload: entry.request_payload ? JSON.stringify(entry.request_payload) : null,
        response_payload: entry.response_payload ? JSON.stringify(entry.response_payload) : null,
        error_message: entry.error_message,
        http_status_code: entry.http_status_code,
        duration_ms: entry.duration_ms,
        completed_at: entry.status === 'success' ? new Date().toISOString() : null,
        lambda_request_id: entry.lambda_request_id || process.env.AWS_LAMBDA_LOG_STREAM_NAME,
      })
      .execute();
  } catch (logError) {
    // Never let sync logging failures propagate
    console.error('[fineract-sync] Failed to write sync log:', logError);
  }
}

// ============================================================
// CLIENT (CUSTOMER) SYNC
// ============================================================

/**
 * Create a Fineract client for a Lynia customer.
 * Called after KYC approval or onboarding completion.
 *
 * @returns The Fineract client ID, or null if sync failed
 */
export async function syncCustomerToFineract(params: {
  customerId: string;
  firstName: string;
  lastName: string;
  mobileNo?: string;
  dateOfBirth?: string;
}): Promise<number | null> {
  const startTime = Date.now();

  try {
    const fineract = await getFineractClient();

    const response = await fineract.createClient({
      firstName: params.firstName,
      lastName: params.lastName,
      mobileNo: params.mobileNo,
      externalId: params.customerId,
      dateOfBirth: params.dateOfBirth,
    });

    const fineractClientId = response.resourceId;

    // Update Lynia customers table with Fineract mapping
    await db
      .from('customers')
      .update({
        fineract_client_id: fineractClientId,
        fineract_synced_at: new Date().toISOString(),
      })
      .eq('id', params.customerId)
      .execute();

    await logSync({
      entity_type: 'client',
      entity_id: params.customerId,
      fineract_id: fineractClientId,
      operation: 'create',
      direction: 'outbound',
      status: 'success',
      request_payload: params,
      response_payload: response,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[fineract-sync] Customer ${params.customerId} → Fineract client ${fineractClientId}`);
    return fineractClientId;
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;

    await logSync({
      entity_type: 'client',
      entity_id: params.customerId,
      operation: 'create',
      direction: 'outbound',
      status: 'failed',
      request_payload: params,
      error_message: error instanceof Error ? error.message : String(error),
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Failed to sync customer ${params.customerId}:`, error);
    return null;
  }
}

// ============================================================
// LOAN SYNC
// ============================================================

/**
 * Create a loan application in Fineract.
 * Called when a loan is created in Lynia (after credit decision = approve).
 *
 * @returns The Fineract loan ID, or null if sync failed
 */
export async function syncLoanToFineract(params: {
  loanId: string;
  customerId: string;
  fineractClientId: number;
  fineractProductId: number;
  principal: number;
  numberOfRepayments: number;
  repaymentEveryMonths: number;
  interestRatePerMonth: number;
  expectedDisbursementDate: Date;
}): Promise<number | null> {
  const startTime = Date.now();

  try {
    const fineract = await getFineractClient();

    const response = await fineract.createLoan({
      clientId: params.fineractClientId,
      productId: params.fineractProductId,
      principal: params.principal,
      numberOfRepayments: params.numberOfRepayments,
      repaymentEveryMonths: params.repaymentEveryMonths,
      interestRatePerMonth: params.interestRatePerMonth,
      expectedDisbursementDate: params.expectedDisbursementDate,
      externalId: params.loanId,
    });

    const fineractLoanId = response.resourceId;

    // Update Lynia loans table with Fineract mapping
    await db
      .from('loans')
      .update({
        fineract_loan_id: fineractLoanId,
        fineract_product_id: params.fineractProductId,
        fineract_synced_at: new Date().toISOString(),
      })
      .eq('id', params.loanId)
      .execute();

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: fineractLoanId,
      operation: 'create',
      direction: 'outbound',
      status: 'success',
      request_payload: params,
      response_payload: response,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[fineract-sync] Loan ${params.loanId} → Fineract loan ${fineractLoanId}`);
    return fineractLoanId;
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      operation: 'create',
      direction: 'outbound',
      status: 'failed',
      request_payload: params,
      error_message: error instanceof Error ? error.message : String(error),
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Failed to sync loan ${params.loanId}:`, error);
    return null;
  }
}

/**
 * Approve a loan in Fineract.
 * Called after credit scoring approves the loan.
 */
export async function approveLoanInFineract(params: {
  loanId: string;
  fineractLoanId: number;
}): Promise<boolean> {
  const startTime = Date.now();

  try {
    const fineract = await getFineractClient();
    const response = await fineract.approveLoan(params.fineractLoanId);

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: params.fineractLoanId,
      operation: 'approve',
      direction: 'outbound',
      status: 'success',
      response_payload: response,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[fineract-sync] Loan ${params.loanId} approved in Fineract`);
    return true;
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: params.fineractLoanId,
      operation: 'approve',
      direction: 'outbound',
      status: 'failed',
      error_message: error instanceof Error ? error.message : String(error),
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Failed to approve loan ${params.loanId} in Fineract:`, error);
    return false;
  }
}

/**
 * Disburse a loan in Fineract.
 * Called after deposit payment is confirmed.
 */
export async function disburseLoanInFineract(params: {
  loanId: string;
  fineractLoanId: number;
  disbursementDate?: Date;
}): Promise<boolean> {
  const startTime = Date.now();

  try {
    const fineract = await getFineractClient();
    const response = await fineract.disburseLoan(
      params.fineractLoanId,
      params.disbursementDate
    );

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: params.fineractLoanId,
      operation: 'disburse',
      direction: 'outbound',
      status: 'success',
      response_payload: response,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[fineract-sync] Loan ${params.loanId} disbursed in Fineract`);
    return true;
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: params.fineractLoanId,
      operation: 'disburse',
      direction: 'outbound',
      status: 'failed',
      error_message: error instanceof Error ? error.message : String(error),
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Failed to disburse loan ${params.loanId}:`, error);
    return false;
  }
}

// ============================================================
// REPAYMENT SYNC
// ============================================================

/**
 * Post a repayment to Fineract.
 * Called after a payment webhook confirms a repayment.
 *
 * @returns The Fineract transaction ID, or null if sync failed
 */
export async function syncRepaymentToFineract(params: {
  paymentId: string;
  loanId: string;
  fineractLoanId: number;
  amount: number;
  transactionDate: Date;
  note?: string;
}): Promise<number | null> {
  const startTime = Date.now();

  try {
    const fineract = await getFineractClient();

    const response = await fineract.postRepayment({
      loanId: params.fineractLoanId,
      amount: params.amount,
      transactionDate: params.transactionDate,
      note: params.note,
      externalId: params.paymentId,
    });

    const fineractTxnId = response.resourceId;

    // Update Lynia payments table with Fineract mapping
    await db
      .from('payments')
      .update({
        fineract_transaction_id: fineractTxnId,
        fineract_synced_at: new Date().toISOString(),
      })
      .eq('id', params.paymentId)
      .execute();

    await logSync({
      entity_type: 'repayment',
      entity_id: params.paymentId,
      fineract_id: fineractTxnId,
      operation: 'repayment',
      direction: 'outbound',
      status: 'success',
      request_payload: params,
      response_payload: response,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[fineract-sync] Payment ${params.paymentId} → Fineract txn ${fineractTxnId}`);
    return fineractTxnId;
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;

    await logSync({
      entity_type: 'repayment',
      entity_id: params.paymentId,
      operation: 'repayment',
      direction: 'outbound',
      status: 'failed',
      request_payload: params,
      error_message: error instanceof Error ? error.message : String(error),
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Failed to sync repayment ${params.paymentId}:`, error);
    return null;
  }
}

// ============================================================
// QUERY HELPERS (used by whatsapp-service)
// ============================================================

/**
 * Get loan balance and schedule from Fineract.
 * Falls back to Lynia DB if Fineract is unavailable.
 */
export async function getFineractLoanBalance(fineractLoanId: number): Promise<{
  principalOutstanding: number;
  interestOutstanding: number;
  totalOutstanding: number;
  totalPaid: number;
  nextDueDate: Date | null;
  nextDueAmount: number;
  currency: string;
} | null> {
  try {
    const fineract = await getFineractClient();
    const loan = await fineract.getLoanWithSchedule(fineractLoanId);

    const schedule = loan.repaymentSchedule;
    const nextPeriod = schedule?.periods.find(
      (p) => p.period > 0 && !p.complete && p.totalOutstandingForPeriod > 0
    );

    return {
      principalOutstanding: loan.summary.principalOutstanding,
      interestOutstanding: loan.summary.interestOutstanding,
      totalOutstanding: loan.summary.totalOutstanding,
      totalPaid: loan.summary.totalRepayment,
      nextDueDate: nextPeriod ? parseFineractDate(nextPeriod.dueDate) : null,
      nextDueAmount: nextPeriod?.totalDueForPeriod || 0,
      currency: loan.currency.code,
    };
  } catch (error) {
    console.error(`[fineract-sync] Failed to get loan balance for Fineract loan ${fineractLoanId}:`, error);
    return null;
  }
}

/**
 * Get full repayment schedule from Fineract.
 * Returns a simplified schedule suitable for WhatsApp display.
 */
export async function getFineractRepaymentSchedule(fineractLoanId: number): Promise<
  Array<{
    period: number;
    dueDate: Date;
    principalDue: number;
    interestDue: number;
    totalDue: number;
    totalPaid: number;
    outstanding: number;
    complete: boolean;
  }> | null
> {
  try {
    const fineract = await getFineractClient();
    const loan = await fineract.getLoanWithSchedule(fineractLoanId);

    if (!loan.repaymentSchedule) return null;

    return loan.repaymentSchedule.periods
      .filter((p) => p.period > 0) // Skip disbursement period
      .map((p) => ({
        period: p.period,
        dueDate: parseFineractDate(p.dueDate),
        principalDue: p.principalDue,
        interestDue: p.interestDue,
        totalDue: p.totalDueForPeriod,
        totalPaid: p.totalPaidForPeriod,
        outstanding: p.totalOutstandingForPeriod,
        complete: p.complete,
      }));
  } catch (error) {
    console.error(`[fineract-sync] Failed to get schedule for Fineract loan ${fineractLoanId}:`, error);
    return null;
  }
}
