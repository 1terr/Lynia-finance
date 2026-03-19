/**
 * Fineract Reconciliation Job
 *
 * Compares loan balances between the Lynia PostgreSQL database and
 * Apache Fineract, flags discrepancies, and retries failed sync
 * operations. Designed to run as a scheduled Lambda via EventBridge
 * every 6 hours.
 *
 * Reconciliation flow:
 *   1. Query all Lynia loans with a fineract_loan_id
 *   2. For each, fetch Fineract loan balance
 *   3. Compare outstanding amounts — flag if drift > $0.01
 *   4. Retry any failed sync log entries (max 3 attempts)
 *   5. Emit CloudWatch metrics for monitoring
 *
 * This job is the safety net that ensures Lynia DB and Fineract
 * stay in sync even if individual sync calls fail.
 */

import { getFineractClient, FineractApiError } from './fineract';
import { syncProductToFineract } from './fineract-sync/sync-product';
import { db } from './database';

// ============================================================
// TYPES
// ============================================================

interface ReconciliationResult {
  totalLoansChecked: number;
  matchedLoans: number;
  discrepancies: DiscrepancyDetail[];
  failedChecks: number;
  retriedSyncs: number;
  retriedSuccesses: number;
  durationMs: number;
  timestamp: string;
}

interface DiscrepancyDetail {
  lyniaLoanId: string;
  fineractLoanId: number;
  lyniaOutstanding: number;
  fineractOutstanding: number;
  difference: number;
  severity: 'low' | 'medium' | 'high';
}

interface LyniaLoanRow {
  id: string;
  fineract_loan_id: number;
  outstanding_balance: number;
  total_paid_usd: number;
  status: string;
  loan_number: string;
}

interface FailedSyncRow {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  request_payload: string;
  attempt_number: number;
  max_attempts: number;
}

// ============================================================
// RECONCILIATION
// ============================================================

/** Tolerance for floating-point comparison (1 cent) */
const TOLERANCE_USD = 0.01;

/**
 * Run the full reconciliation cycle.
 * Returns a summary suitable for logging and CloudWatch metrics.
 */
export async function runReconciliation(): Promise<ReconciliationResult> {
  const startTime = Date.now();
  const result: ReconciliationResult = {
    totalLoansChecked: 0,
    matchedLoans: 0,
    discrepancies: [],
    failedChecks: 0,
    retriedSyncs: 0,
    retriedSuccesses: 0,
    durationMs: 0,
    timestamp: new Date().toISOString(),
  };

  console.log('[reconcile] Starting reconciliation cycle');

  // ----------------------------------------------------------
  // Step 1: Reconcile loan balances
  // ----------------------------------------------------------
  try {
    const { data: loans, error } = await db
      .from('loans')
      .select('id, fineract_loan_id, outstanding_balance, total_paid_usd, status, loan_number')
      .not('fineract_loan_id', 'is', null)
      .execute();

    if (error || !loans) {
      console.error('[reconcile] Failed to query Lynia loans:', error);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    const loanRows = loans as unknown as LyniaLoanRow[];
    result.totalLoansChecked = loanRows.length;
    console.log(`[reconcile] Checking ${loanRows.length} loans with Fineract IDs`);

    const fineract = await getFineractClient();

    for (const loan of loanRows) {
      try {
        const fineractLoan = await fineract.getLoan(loan.fineract_loan_id);
        const fineractOutstanding = fineractLoan.summary?.totalOutstanding ?? 0;
        const lyniaOutstanding = loan.outstanding_balance ?? 0;
        const difference = Math.abs(lyniaOutstanding - fineractOutstanding);

        if (difference <= TOLERANCE_USD) {
          result.matchedLoans++;
        } else {
          const severity = classifyDiscrepancy(difference, lyniaOutstanding);

          result.discrepancies.push({
            lyniaLoanId: loan.id,
            fineractLoanId: loan.fineract_loan_id,
            lyniaOutstanding,
            fineractOutstanding,
            difference,
            severity,
          });

          // Log discrepancy to sync log
          await db
            .from('fineract_sync_log')
            .insert({
              entity_type: 'loan',
              entity_id: loan.id,
              fineract_id: loan.fineract_loan_id,
              operation: 'reconcile',
              direction: 'inbound',
              status: 'failed',
              error_message: `Balance mismatch: Lynia=$${lyniaOutstanding.toFixed(2)} vs Fineract=$${fineractOutstanding.toFixed(2)} (diff=$${difference.toFixed(2)}, severity=${severity})`,
              completed_at: new Date().toISOString(),
            })
            .execute();

          console.warn(
            `[reconcile] DISCREPANCY loan ${loan.loan_number}: ` +
            `Lynia=$${lyniaOutstanding.toFixed(2)} vs Fineract=$${fineractOutstanding.toFixed(2)} ` +
            `(diff=$${difference.toFixed(2)}, severity=${severity})`
          );
        }
      } catch (checkError) {
        result.failedChecks++;
        console.error(`[reconcile] Failed to check loan ${loan.id}:`, checkError);
      }
    }
  } catch (queryError) {
    console.error('[reconcile] Loan query failed:', queryError);
  }

  // ----------------------------------------------------------
  // Step 2: Retry failed sync operations
  // ----------------------------------------------------------
  try {
    const { data: failedSyncs, error } = await db
      .from('fineract_sync_log')
      .select('id, entity_type, entity_id, operation, request_payload, attempt_number, max_attempts')
      .eq('status', 'failed')
      .lt('attempt_number', 3)
      .neq('operation', 'reconcile')
      .order('created_at', { ascending: true })
      .limit(50)
      .execute();

    if (error || !failedSyncs) {
      console.error('[reconcile] Failed to query failed syncs:', error);
    } else {
      const syncRows = failedSyncs as unknown as FailedSyncRow[];
      console.log(`[reconcile] Found ${syncRows.length} failed syncs to retry`);

      for (const sync of syncRows) {
        result.retriedSyncs++;
        try {
          const retried = await retrySyncOperation(sync);
          if (retried) {
            result.retriedSuccesses++;
          }
        } catch (retryError) {
          console.error(`[reconcile] Retry failed for sync ${sync.id}:`, retryError);
        }
      }
    }
  } catch (retryQueryError) {
    console.error('[reconcile] Failed sync retry query failed:', retryQueryError);
  }

  // ----------------------------------------------------------
  // Step 3: Finalize
  // ----------------------------------------------------------
  result.durationMs = Date.now() - startTime;

  console.log('[reconcile] Reconciliation complete:', {
    totalLoansChecked: result.totalLoansChecked,
    matched: result.matchedLoans,
    discrepancies: result.discrepancies.length,
    failedChecks: result.failedChecks,
    retriedSyncs: result.retriedSyncs,
    retriedSuccesses: result.retriedSuccesses,
    durationMs: result.durationMs,
  });

  return result;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Classify discrepancy severity based on the absolute difference
 * and its proportion to the outstanding balance.
 */
function classifyDiscrepancy(difference: number, lyniaOutstanding: number): 'low' | 'medium' | 'high' {
  // Percentage of outstanding balance
  const percentage = lyniaOutstanding > 0 ? (difference / lyniaOutstanding) * 100 : 100;

  if (difference > 50 || percentage > 10) return 'high';
  if (difference > 5 || percentage > 2) return 'medium';
  return 'low';
}

/**
 * Retry a single failed sync operation.
 * Increments the attempt counter and updates status.
 */
async function retrySyncOperation(sync: FailedSyncRow): Promise<boolean> {
  const newAttempt = sync.attempt_number + 1;

  // Mark as retrying
  await db
    .from('fineract_sync_log')
    .update({
      status: 'retrying',
      attempt_number: newAttempt,
    })
    .eq('id', sync.id)
    .execute();

  let payload: Record<string, unknown> = {};
  try {
    payload = typeof sync.request_payload === 'string'
      ? JSON.parse(sync.request_payload)
      : (sync.request_payload as Record<string, unknown>) || {};
  } catch {
    // Payload is not valid JSON
  }

  const fineract = await getFineractClient();
  let success = false;

  try {
    switch (`${sync.entity_type}:${sync.operation}`) {
      case 'client:create': {
        const response = await fineract.createClient({
          firstName: payload.firstName as string,
          lastName: payload.lastName as string,
          externalId: payload.customerId as string,
          mobileNo: payload.mobileNo as string | undefined,
        });

        // Update customer with Fineract ID
        await db
          .from('customers')
          .update({
            fineract_client_id: response.resourceId,
            fineract_synced_at: new Date().toISOString(),
          })
          .eq('id', sync.entity_id)
          .execute();

        success = true;
        break;
      }

      case 'loan:create': {
        const response = await fineract.createLoan({
          clientId: payload.fineractClientId as number,
          productId: payload.fineractProductId as number,
          principal: payload.principal as number,
          numberOfRepayments: payload.numberOfRepayments as number,
          repaymentEveryMonths: payload.repaymentEveryMonths as number,
          interestRatePerMonth: payload.interestRatePerMonth as number,
          expectedDisbursementDate: new Date(payload.expectedDisbursementDate as string),
          externalId: sync.entity_id,
        });

        await db
          .from('loans')
          .update({
            fineract_loan_id: response.resourceId,
            fineract_synced_at: new Date().toISOString(),
          })
          .eq('id', sync.entity_id)
          .execute();

        success = true;
        break;
      }

      case 'loan:approve': {
        await fineract.approveLoan(payload.fineractLoanId as number);
        success = true;
        break;
      }

      case 'loan:disburse': {
        await fineract.disburseLoan(payload.fineractLoanId as number);
        success = true;
        break;
      }

      case 'loan_product:create': {
        const syncResult = await syncProductToFineract(sync.entity_id);
        success = syncResult.success;
        break;
      }

      case 'repayment:repayment': {
        const response = await fineract.postRepayment({
          loanId: payload.fineractLoanId as number,
          amount: payload.amount as number,
          transactionDate: new Date(payload.transactionDate as string),
          externalId: sync.entity_id,
        });

        await db
          .from('payments')
          .update({
            fineract_transaction_id: response.resourceId,
            fineract_synced_at: new Date().toISOString(),
          })
          .eq('id', sync.entity_id)
          .execute();

        success = true;
        break;
      }

      default:
        console.warn(`[reconcile] Unknown sync operation: ${sync.entity_type}:${sync.operation}`);
    }
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;

    await db
      .from('fineract_sync_log')
      .update({
        status: newAttempt >= (sync.max_attempts || 3) ? 'exhausted' : 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        http_status_code: apiError?.statusCode,
      })
      .eq('id', sync.id)
      .execute();

    return false;
  }

  if (success) {
    await db
      .from('fineract_sync_log')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sync.id)
      .execute();

    console.log(`[reconcile] Retry successful for ${sync.entity_type}:${sync.operation} (entity: ${sync.entity_id})`);
  }

  return success;
}

// ============================================================
// LAMBDA HANDLER (for EventBridge scheduled invocation)
// ============================================================

/**
 * Lambda handler for the reconciliation scheduled job.
 * Triggered by EventBridge rule every 6 hours.
 */
export async function reconciliationHandler(): Promise<{
  statusCode: number;
  body: string;
}> {
  try {
    const result = await runReconciliation();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        reconciliation: {
          totalLoansChecked: result.totalLoansChecked,
          matchedLoans: result.matchedLoans,
          discrepancyCount: result.discrepancies.length,
          failedChecks: result.failedChecks,
          retriedSyncs: result.retriedSyncs,
          retriedSuccesses: result.retriedSuccesses,
          durationMs: result.durationMs,
        },
      }),
    };
  } catch (error) {
    console.error('[reconcile] Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Reconciliation failed',
      }),
    };
  }
}
