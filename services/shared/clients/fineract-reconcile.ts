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
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger } from '../utils/logger';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
const METRIC_NAMESPACE = `Lynia/${process.env.NODE_ENV || 'development'}`;

// ============================================================
// TYPES
// ============================================================

interface GLMismatchDetail {
  productId: string;
  fineractProductId: number;
  field: string;
  lyniaValue: number | null;
  fineractValue: number | null;
  severity: 'high';
}

interface ReconciliationResult {
  totalLoansChecked: number;
  matchedLoans: number;
  discrepancies: DiscrepancyDetail[];
  failedChecks: number;
  retriedSyncs: number;
  retriedSuccesses: number;
  glMismatches: GLMismatchDetail[];
  glProductsChecked: number;
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
  productCategory: ProductCategory;
}

type ProductCategory = 'smartphone' | 'digital';

interface LyniaLoanRow {
  id: string;
  fineract_loan_id: number;
  outstanding_balance: number;
  total_paid_usd: number;
  status: string;
  loan_number: string;
  product_category: ProductCategory;
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
    glMismatches: [],
    glProductsChecked: 0,
    durationMs: 0,
    timestamp: new Date().toISOString(),
  };

  logger.info('Starting reconciliation cycle', { action: 'reconciliation.start' });

  // ----------------------------------------------------------
  // Step 1: Reconcile loan balances
  // ----------------------------------------------------------
  try {
    const { data: loans, error } = await db
      .from('loans')
      .select('id, fineract_loan_id, outstanding_balance, total_paid_usd, status, loan_number, product_category')
      .not('fineract_loan_id', 'is', null)
      .execute();

    if (error || !loans) {
      logger.error('Failed to query Lynia loans', { action: 'reconciliation.query_loans', error: String(error) });
      result.durationMs = Date.now() - startTime;
      return result;
    }

    const loanRows = loans as unknown as LyniaLoanRow[];
    result.totalLoansChecked = loanRows.length;
    logger.info('Checking loans with Fineract IDs', { action: 'reconciliation.check_loans', count: loanRows.length });

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
            productCategory: loan.product_category,
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

          logger.warn('Loan balance discrepancy detected', {
            action: 'reconciliation.discrepancy',
            loanNumber: loan.loan_number,
            lyniaOutstanding,
            fineractOutstanding,
            difference,
            severity,
            productCategory: loan.product_category,
          });
        }
      } catch (checkError) {
        result.failedChecks++;
        logger.error('Failed to check loan balance', { action: 'reconciliation.check_loan', loanId: loan.id, error: checkError instanceof Error ? checkError.message : String(checkError) });
      }
    }
  } catch (queryError) {
    logger.error('Loan query failed', { action: 'reconciliation.query_loans', error: queryError instanceof Error ? queryError.message : String(queryError) });
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
      logger.error('Failed to query failed syncs', { action: 'reconciliation.query_failed_syncs', error: String(error) });
    } else {
      const syncRows = failedSyncs as unknown as FailedSyncRow[];
      logger.info('Found failed syncs to retry', { action: 'reconciliation.retry_syncs', count: syncRows.length });

      for (const sync of syncRows) {
        result.retriedSyncs++;
        try {
          const retried = await retrySyncOperation(sync);
          if (retried) {
            result.retriedSuccesses++;
          }
        } catch (retryError) {
          logger.error('Retry failed for sync operation', { action: 'reconciliation.retry', syncId: sync.id, error: retryError instanceof Error ? retryError.message : String(retryError) });
        }
      }
    }
  } catch (retryQueryError) {
    logger.error('Failed sync retry query failed', { action: 'reconciliation.retry_query', error: retryQueryError instanceof Error ? retryQueryError.message : String(retryQueryError) });
  }

  // ----------------------------------------------------------
  // Step 3: Reconcile GL account mappings
  // ----------------------------------------------------------
  try {
    const glResult = await reconcileGLAccounts();
    result.glMismatches = glResult.mismatches;
    result.glProductsChecked = glResult.productsChecked;
  } catch (glError) {
    logger.error('GL account reconciliation failed', { action: 'reconciliation.gl_accounts', error: glError instanceof Error ? glError.message : String(glError) });
  }

  // ----------------------------------------------------------
  // Step 4: Count pending approval sync failures
  // ----------------------------------------------------------
  let approvalSyncFailures = 0;
  let totalPendingSyncFailures = 0;
  try {
    const { data: failedApprovals } = await db
      .from('fineract_sync_log')
      .select('id')
      .eq('operation', 'approve')
      .in('status', ['failed', 'exhausted'])
      .execute();

    approvalSyncFailures = Array.isArray(failedApprovals) ? failedApprovals.length : 0;

    const { data: allFailed } = await db
      .from('fineract_sync_log')
      .select('id')
      .in('status', ['failed', 'exhausted'])
      .neq('operation', 'reconcile')
      .execute();

    totalPendingSyncFailures = Array.isArray(allFailed) ? allFailed.length : 0;
  } catch (countError) {
    logger.error('Failed to count sync failures', { action: 'reconciliation.count_failures', error: countError instanceof Error ? countError.message : String(countError) });
  }

  // ----------------------------------------------------------
  // Step 5: Emit CloudWatch metrics
  // ----------------------------------------------------------
  try {
    // Count discrepancies per product category
    const smartphoneDiscrepancies = result.discrepancies.filter(
      (d) => d.productCategory === 'smartphone'
    ).length;
    const digitalDiscrepancies = result.discrepancies.filter(
      (d) => d.productCategory === 'digital'
    ).length;

    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: METRIC_NAMESPACE,
      MetricData: [
        {
          MetricName: 'FineractApprovalSyncFailures',
          Value: approvalSyncFailures,
          Unit: 'Count',
          Timestamp: new Date(),
        },
        {
          MetricName: 'FineractPendingSyncFailures',
          Value: totalPendingSyncFailures,
          Unit: 'Count',
          Timestamp: new Date(),
        },
        {
          MetricName: 'FineractReconciliationDiscrepancies',
          Value: result.discrepancies.length,
          Unit: 'Count',
          Timestamp: new Date(),
        },
        {
          MetricName: 'ReconciliationDiscrepancies',
          Dimensions: [{ Name: 'ProductCategory', Value: 'smartphone' }],
          Value: smartphoneDiscrepancies,
          Unit: 'Count',
          Timestamp: new Date(),
        },
        {
          MetricName: 'ReconciliationDiscrepancies',
          Dimensions: [{ Name: 'ProductCategory', Value: 'digital' }],
          Value: digitalDiscrepancies,
          Unit: 'Count',
          Timestamp: new Date(),
        },
        {
          MetricName: 'GLAccountMismatch',
          Value: result.glMismatches.length,
          Unit: 'Count',
          Timestamp: new Date(),
        },
      ],
    }));
    logger.info('CloudWatch metrics emitted', {
      action: 'reconciliation.metrics',
      approvalSyncFailures,
      totalPendingSyncFailures,
      discrepancies: result.discrepancies.length,
      smartphoneDiscrepancies,
      digitalDiscrepancies,
      glMismatches: result.glMismatches.length,
    });
  } catch (metricError) {
    logger.error('Failed to emit CloudWatch metrics', { action: 'reconciliation.metrics', error: metricError instanceof Error ? metricError.message : String(metricError) });
  }

  // ----------------------------------------------------------
  // Step 6: Finalize
  // ----------------------------------------------------------
  result.durationMs = Date.now() - startTime;

  // Per-category summary
  const smartphoneTotal = result.discrepancies.filter((d) => d.productCategory === 'smartphone').length;
  const digitalTotal = result.discrepancies.filter((d) => d.productCategory === 'digital').length;

  logger.info('Reconciliation complete', {
    action: 'reconciliation.complete',
    totalLoansChecked: result.totalLoansChecked,
    matched: result.matchedLoans,
    discrepancies: result.discrepancies.length,
    discrepanciesByCategory: { smartphone: smartphoneTotal, digital: digitalTotal },
    failedChecks: result.failedChecks,
    retriedSyncs: result.retriedSyncs,
    retriedSuccesses: result.retriedSuccesses,
    approvalSyncFailures,
    totalPendingSyncFailures,
    glProductsChecked: result.glProductsChecked,
    glMismatches: result.glMismatches.length,
    durationMs: result.durationMs,
  });

  return result;
}

// ============================================================
// GL ACCOUNT RECONCILIATION
// ============================================================

/** GL account fields stored in Lynia loan_products that map to Fineract accountingMappings */
const GL_ACCOUNT_FIELDS = [
  { lyniaField: 'fund_source_account_id', fineractKey: 'fundSourceAccountId' },
  { lyniaField: 'loan_portfolio_account_id', fineractKey: 'loanPortfolioAccountId' },
  { lyniaField: 'transfers_in_suspense_account_id', fineractKey: 'transfersInSuspenseAccountId' },
  { lyniaField: 'interest_on_loan_account_id', fineractKey: 'interestOnLoanAccountId' },
  { lyniaField: 'income_from_fee_account_id', fineractKey: 'incomeFromFeeAccountId' },
  { lyniaField: 'income_from_penalty_account_id', fineractKey: 'incomeFromPenaltyAccountId' },
  { lyniaField: 'write_off_account_id', fineractKey: 'writeOffAccountId' },
  { lyniaField: 'overpayment_liability_account_id', fineractKey: 'overpaymentLiabilityAccountId' },
  { lyniaField: 'income_from_recovery_account_id', fineractKey: 'incomeFromRecoveryAccountId' },
  { lyniaField: 'receivable_interest_account_id', fineractKey: 'receivableInterestAccountId' },
  { lyniaField: 'receivable_fee_account_id', fineractKey: 'receivableFeeAccountId' },
  { lyniaField: 'receivable_penalty_account_id', fineractKey: 'receivablePenaltyAccountId' },
] as const;

interface GLReconciliationResult {
  productsChecked: number;
  mismatches: GLMismatchDetail[];
}

/**
 * Reconcile GL account mappings between Lynia DB and Fineract.
 *
 * For each active loan product with a fineract_product_id:
 *  1. Fetch the Fineract loan product details
 *  2. Compare 12 GL account ID fields
 *  3. Log mismatches with structured logging
 */
async function reconcileGLAccounts(): Promise<GLReconciliationResult> {
  const mismatches: GLMismatchDetail[] = [];

  const { data: products, error } = await db
    .from('loan_products')
    .select('*')
    .not('fineract_product_id', 'is', null)
    .is('deleted_at', null)
    .execute();

  if (error || !products) {
    logger.error('Failed to query loan products for GL reconciliation', { action: 'reconciliation.gl_accounts', error: String(error) });
    return { productsChecked: 0, mismatches: [] };
  }

  const productRows = products as unknown as Array<Record<string, unknown>>;
  logger.info('Checking GL accounts for products', { action: 'reconciliation.gl_accounts', count: productRows.length });

  const fineract = await getFineractClient();

  for (const product of productRows) {
    const productId = product.id as string;
    const fineractProductId = product.fineract_product_id as number;

    try {
      const fineractProduct = await fineract.getLoanProduct(fineractProductId);
      const accountingMappings = fineractProduct.accountingMappings || {};

      for (const { lyniaField, fineractKey } of GL_ACCOUNT_FIELDS) {
        const lyniaValue = (product[lyniaField] as number | null) ?? null;
        const fineractMapping = accountingMappings[fineractKey] as
          | { id: number; name: string; glCode: string }
          | undefined;
        const fineractValue = fineractMapping?.id ?? null;

        // Skip comparison if both are null (field not configured)
        if (lyniaValue === null && fineractValue === null) {
          continue;
        }

        if (lyniaValue !== fineractValue) {
          const mismatch: GLMismatchDetail = {
            productId,
            fineractProductId,
            field: lyniaField,
            lyniaValue,
            fineractValue,
            severity: 'high',
          };
          mismatches.push(mismatch);

          logger.warn('GL account mismatch detected', {
            action: 'reconciliation.gl_mismatch',
            productId,
            fineractProductId,
            field: lyniaField,
            lyniaValue,
            fineractValue,
            severity: 'high',
          });
        }
      }
    } catch (checkError) {
      logger.error('Failed to check GL accounts for product', { action: 'reconciliation.gl_accounts', productId, error: checkError instanceof Error ? checkError.message : String(checkError) });
    }
  }

  logger.info('GL reconciliation complete', { action: 'reconciliation.gl_complete', productsChecked: productRows.length, mismatches: mismatches.length });
  return { productsChecked: productRows.length, mismatches };
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
        logger.warn('Unknown sync operation', { action: 'reconciliation.retry', entityType: sync.entity_type, operation: sync.operation });
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

    logger.info('Retry successful', { action: 'reconciliation.retry', entityType: sync.entity_type, operation: sync.operation, entityId: sync.entity_id });
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
          glProductsChecked: result.glProductsChecked,
          glMismatchCount: result.glMismatches.length,
          durationMs: result.durationMs,
        },
      }),
    };
  } catch (error) {
    logger.error('Reconciliation handler error', { action: 'reconciliation.handler', error: error instanceof Error ? error.message : String(error) });
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Reconciliation failed',
      }),
    };
  }
}
