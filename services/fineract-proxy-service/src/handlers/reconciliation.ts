/**
 * Reconciliation Handlers
 *
 * GET endpoint for latest reconciliation results, and
 * POST endpoint to trigger a manual reconciliation run.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { runReconciliation } from '../../../shared/clients/fineract-reconcile';
import { db } from '../../../shared/clients/database';
import { getFineractClient } from '../../../shared/clients/fineract';
import logger from '../../../shared/utils/logger';
import type { RouteParams } from '../../../shared/utils/lambda-router';
import type { AuthContext } from '../../../shared/middleware/authorization';
import { ok } from './helpers';

// ============================================================
// GET /api/v1/fineract/reconciliation
// ============================================================

export async function handleGetReconciliation(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  // Run DB query and Fineract health check in parallel so the health check
  // doesn't add latency on top of the DB round-trip.
  const [dbResult, retryResult, fineractReachable] = await Promise.all([
    db
      .from('fineract_sync_log')
      .select('id, entity_type, entity_id, fineract_id, operation, status, error_message, created_at')
      .eq('operation', 'reconcile')
      .order('created_at', { ascending: false })
      .limit(100)
      .execute(),
    db
      .from('fineract_sync_log')
      .select('id, status')
      .eq('status', 'retrying')
      .execute(),
    getFineractClient()
      .then((f) => f.healthCheck())
      .catch(() => false),
  ]);

  if (dbResult.error) {
    logger.error('Reconciliation query failed', {
      action: 'fineract.getReconciliation',
      meta: { error: dbResult.error.message },
    });
    // Return a valid "not yet run" response — never 500 — so the frontend
    // only shows the degraded banner based on fineractReachable, not on a
    // DB connectivity issue.
    return ok(
      {
        runAt: new Date().toISOString(),
        totalLoansChecked: 0,
        matchedCount: 0,
        discrepancyCount: 0,
        discrepancies: [],
        retriedSyncs: 0,
        retrySuccessCount: 0,
        fineractReachable,
      },
      event
    );
  }

  const logs = (dbResult.data as unknown as Array<{
    entity_id: string;
    fineract_id: number;
    status: string;
    error_message: string;
    created_at: string;
  }>) || [];

  // Parse discrepancies from error messages
  const discrepancies = logs
    .filter((l) => l.status === 'failed' && l.error_message?.includes('Balance mismatch'))
    .map((l) => {
      const match = l.error_message?.match(
        /Lynia=\$([0-9.]+) vs Fineract=\$([0-9.]+) \(diff=\$([0-9.]+), severity=(\w+)\)/
      );
      return {
        lyniaLoanId: l.entity_id,
        fineractLoanId: l.fineract_id,
        customerName: '',
        lyniaBalance: match ? parseFloat(match[1]) : 0,
        fineractBalance: match ? parseFloat(match[2]) : 0,
        difference: match ? parseFloat(match[3]) : 0,
        severity: (match?.[4] || 'low') as 'low' | 'medium' | 'high',
        lastSyncedAt: l.created_at,
      };
    });

  if (retryResult.error) {
    logger.error('Retry query failed', {
      action: 'fineract.getReconciliation',
      meta: { error: retryResult.error.message },
    });
  }

  const retryCount = Array.isArray(retryResult.data) ? retryResult.data.length : 0;
  const runAt = logs.length > 0 ? logs[0].created_at : new Date().toISOString();

  return ok(
    {
      runAt,
      totalLoansChecked: logs.length,
      matchedCount: logs.filter((l) => l.status === 'success').length,
      discrepancyCount: discrepancies.length,
      discrepancies,
      retriedSyncs: retryCount,
      retrySuccessCount: 0,
      fineractReachable,
    },
    event
  );
}

// ============================================================
// POST /api/v1/fineract/reconciliation/run
// ============================================================

export async function handleRunReconciliation(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await runReconciliation();

  const discrepancies = result.discrepancies.map((d) => ({
    lyniaLoanId: d.lyniaLoanId,
    fineractLoanId: d.fineractLoanId,
    customerName: '',
    lyniaBalance: d.lyniaOutstanding,
    fineractBalance: d.fineractOutstanding,
    difference: d.difference,
    severity: d.severity,
    lastSyncedAt: result.timestamp,
  }));

  return ok(
    {
      runAt: result.timestamp,
      totalLoansChecked: result.totalLoansChecked,
      matchedCount: result.matchedLoans,
      discrepancyCount: result.discrepancies.length,
      discrepancies,
      retriedSyncs: result.retriedSyncs,
      retrySuccessCount: result.retriedSuccesses,
    },
    event
  );
}
