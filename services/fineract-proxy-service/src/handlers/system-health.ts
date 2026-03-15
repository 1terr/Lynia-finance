/**
 * System Health Handler
 *
 * Aggregated endpoint that returns a comprehensive snapshot of core banking
 * system health across 5 categories: infrastructure, sync pipeline, data
 * integrity, portfolio reconciliation, and accounting.
 *
 * All queries run in parallel for performance. Each query is independently
 * wrapped in catch() so partial failures degrade gracefully.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db, queryOne } from '../../../shared/clients/database';
import { getFineractClient } from '../../../shared/clients/fineract';
import logger from '../../../shared/utils/logger';
import type { RouteParams } from '../../../shared/utils/lambda-router';
import type { AuthContext } from '../../../shared/middleware/authorization';
import { ok } from './helpers';

// ============================================================
// Types
// ============================================================

export interface CoreBankingHealthResult {
  timestamp: string;
  infrastructure: {
    fineractReachable: boolean;
    circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    apiResponseMs: number;
  };
  syncPipeline: {
    pendingCount: number;
    failedCount: number;
    exhaustedCount: number;
    successRate24h: number;
    totalSyncs24h: number;
    lastSyncAt: string | null;
  };
  dataIntegrity: {
    unsyncedCustomers: number;
    unsyncedLoans: number;
    unsyncedPayments: number;
    discrepancies: { high: number; medium: number; low: number };
  };
  portfolio: {
    totalLoansChecked: number;
    matchedCount: number;
    discrepancyCount: number;
    lastReconciliationAt: string | null;
  };
  accounting: {
    trialBalanceBalanced: boolean;
    totalDebit: number;
    totalCredit: number;
    imbalance: number;
    lastJournalEntryAt: string | null;
  };
}

// ============================================================
// Query helpers (each returns safe defaults on failure)
// ============================================================

async function timedHealthCheck(): Promise<{
  reachable: boolean;
  responseMs: number;
  circuitState: string;
}> {
  const fineract = await getFineractClient();
  const circuitState = fineract.getCircuitState();
  const start = Date.now();
  const reachable = await fineract.healthCheck();
  return { reachable, responseMs: Date.now() - start, circuitState };
}

interface SyncPipelineRow {
  pending_count: string;
  failed_count: string;
  exhausted_count: string;
  success_24h: string;
  total_24h: string;
  last_sync_at: string | null;
}

async function getSyncPipelineCounts(): Promise<CoreBankingHealthResult['syncPipeline']> {
  const result = await queryOne<SyncPipelineRow>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
       COUNT(*) FILTER (WHERE status = 'failed' AND attempt_number < COALESCE(max_attempts, 3)) AS failed_count,
       COUNT(*) FILTER (WHERE status = 'failed' AND attempt_number >= COALESCE(max_attempts, 3)) AS exhausted_count,
       COUNT(*) FILTER (WHERE status = 'success' AND created_at > NOW() - INTERVAL '24 hours') AS success_24h,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS total_24h,
       MAX(created_at) AS last_sync_at
     FROM fineract_sync_log`
  );

  if (result.error || !result.data) {
    return { pendingCount: 0, failedCount: 0, exhaustedCount: 0, successRate24h: 0, totalSyncs24h: 0, lastSyncAt: null };
  }

  const d = result.data;
  const total24h = parseInt(d.total_24h) || 0;
  const success24h = parseInt(d.success_24h) || 0;

  return {
    pendingCount: parseInt(d.pending_count) || 0,
    failedCount: parseInt(d.failed_count) || 0,
    exhaustedCount: parseInt(d.exhausted_count) || 0,
    successRate24h: total24h > 0 ? Math.round((success24h / total24h) * 1000) / 10 : 100,
    totalSyncs24h: total24h,
    lastSyncAt: d.last_sync_at,
  };
}

async function getUnsyncedCounts(): Promise<{
  customers: number;
  loans: number;
  payments: number;
}> {
  const [custResult, loanResult, payResult] = await Promise.all([
    db.from('customers').select('*').is('fineract_client_id', null).eq('kyc_status', 'approved').count().execute(),
    db.from('loans').select('*').is('fineract_loan_id', null).in('status', ['approved', 'disbursed', 'active']).count().execute(),
    db.from('payments').select('*').is('fineract_transaction_id', null).eq('status', 'confirmed').count().execute(),
  ]);

  return {
    customers: custResult.count ?? 0,
    loans: loanResult.count ?? 0,
    payments: payResult.count ?? 0,
  };
}

interface DiscrepancyRow {
  error_message: string;
}

async function getDiscrepancyBreakdown(): Promise<{ high: number; medium: number; low: number }> {
  const result = await db
    .from('fineract_sync_log')
    .select('error_message')
    .eq('operation', 'reconcile')
    .eq('status', 'failed')
    .execute();

  if (result.error || !result.data) {
    return { high: 0, medium: 0, low: 0 };
  }

  const counts = { high: 0, medium: 0, low: 0 };
  for (const row of result.data as unknown as DiscrepancyRow[]) {
    const msg = row.error_message || '';
    if (msg.includes('severity=high')) counts.high++;
    else if (msg.includes('severity=medium')) counts.medium++;
    else if (msg.includes('Balance mismatch')) counts.low++;
  }
  return counts;
}

interface ReconRow {
  status: string;
  created_at: string;
}

async function getPortfolioSummary(): Promise<CoreBankingHealthResult['portfolio']> {
  const result = await db
    .from('fineract_sync_log')
    .select('status, created_at')
    .eq('operation', 'reconcile')
    .order('created_at', { ascending: false })
    .limit(200)
    .execute();

  if (result.error || !result.data) {
    return { totalLoansChecked: 0, matchedCount: 0, discrepancyCount: 0, lastReconciliationAt: null };
  }

  const logs = result.data as unknown as ReconRow[];
  const matched = logs.filter((l) => l.status === 'success').length;
  const failed = logs.filter((l) => l.status === 'failed').length;

  return {
    totalLoansChecked: logs.length,
    matchedCount: matched,
    discrepancyCount: failed,
    lastReconciliationAt: logs.length > 0 ? logs[0].created_at : null,
  };
}

async function getAccountingHealth(
  fineractReachable: boolean
): Promise<CoreBankingHealthResult['accounting']> {
  const defaults: CoreBankingHealthResult['accounting'] = {
    trialBalanceBalanced: true,
    totalDebit: 0,
    totalCredit: 0,
    imbalance: 0,
    lastJournalEntryAt: null,
  };

  if (!fineractReachable) return defaults;

  const fineract = await getFineractClient();
  const entries = await fineract.listJournalEntries({ limit: 500 });

  if (!entries || !Array.isArray(entries.pageItems)) return defaults;

  let totalDebit = 0;
  let totalCredit = 0;
  let lastDate: string | null = null;

  for (const entry of entries.pageItems) {
    if (entry.entryType?.value === 'DEBIT') {
      totalDebit += entry.amount || 0;
    } else {
      totalCredit += entry.amount || 0;
    }
    const entryDate = entry.transactionDate
      ? Array.isArray(entry.transactionDate)
        ? `${entry.transactionDate[0]}-${String(entry.transactionDate[1]).padStart(2, '0')}-${String(entry.transactionDate[2]).padStart(2, '0')}`
        : String(entry.transactionDate)
      : null;
    if (entryDate && (!lastDate || entryDate > lastDate)) {
      lastDate = entryDate;
    }
  }

  const imbalance = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;

  return {
    trialBalanceBalanced: imbalance < 0.01,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    imbalance,
    lastJournalEntryAt: lastDate,
  };
}

// ============================================================
// GET /api/v1/fineract/system-health
// ============================================================

export async function handleGetSystemHealth(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  // Run all queries in parallel — each wrapped in catch for graceful degradation
  const [infraResult, syncResult, unsyncedResult, discrepancyResult, portfolioResult] =
    await Promise.all([
      timedHealthCheck().catch((err) => {
        logger.error('System health: infrastructure check failed', {
          action: 'fineract.systemHealth',
          meta: { error: (err as Error).message },
        });
        return { reachable: false, responseMs: 0, circuitState: 'OPEN' };
      }),
      getSyncPipelineCounts().catch((err) => {
        logger.error('System health: sync pipeline query failed', {
          action: 'fineract.systemHealth',
          meta: { error: (err as Error).message },
        });
        return { pendingCount: 0, failedCount: 0, exhaustedCount: 0, successRate24h: 0, totalSyncs24h: 0, lastSyncAt: null };
      }),
      getUnsyncedCounts().catch((err) => {
        logger.error('System health: unsynced counts query failed', {
          action: 'fineract.systemHealth',
          meta: { error: (err as Error).message },
        });
        return { customers: 0, loans: 0, payments: 0 };
      }),
      getDiscrepancyBreakdown().catch((err) => {
        logger.error('System health: discrepancy query failed', {
          action: 'fineract.systemHealth',
          meta: { error: (err as Error).message },
        });
        return { high: 0, medium: 0, low: 0 };
      }),
      getPortfolioSummary().catch((err) => {
        logger.error('System health: portfolio query failed', {
          action: 'fineract.systemHealth',
          meta: { error: (err as Error).message },
        });
        return { totalLoansChecked: 0, matchedCount: 0, discrepancyCount: 0, lastReconciliationAt: null };
      }),
    ]);

  // Accounting depends on infra reachability — run after infra check
  const accountingResult = await getAccountingHealth(infraResult.reachable).catch((err) => {
    logger.error('System health: accounting query failed', {
      action: 'fineract.systemHealth',
      meta: { error: (err as Error).message },
    });
    return { trialBalanceBalanced: true, totalDebit: 0, totalCredit: 0, imbalance: 0, lastJournalEntryAt: null };
  });

  const result: CoreBankingHealthResult = {
    timestamp: new Date().toISOString(),
    infrastructure: {
      fineractReachable: infraResult.reachable,
      circuitBreakerState: infraResult.circuitState as 'CLOSED' | 'OPEN' | 'HALF_OPEN',
      apiResponseMs: infraResult.responseMs,
    },
    syncPipeline: syncResult,
    dataIntegrity: {
      unsyncedCustomers: unsyncedResult.customers,
      unsyncedLoans: unsyncedResult.loans,
      unsyncedPayments: unsyncedResult.payments,
      discrepancies: discrepancyResult,
    },
    portfolio: portfolioResult,
    accounting: accountingResult,
  };

  return ok(result, event);
}
