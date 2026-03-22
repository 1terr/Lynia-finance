import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';
import { mapActionToEventType } from './helpers';

/**
 * GET /api/v1/dashboard/metrics
 * Main dashboard metrics — customers, loans, devices, KYC, Fineract-enriched data.
 */
export const handleDashboardMetrics: RouteHandler = async (event, _params, _auth) => {
  try {
  // Optional date range filtering
  const qs = event.queryStringParameters || {};
  const dateFrom = qs.date_from || null; // ISO date string e.g. '2026-01-01'
  const dateTo = qs.date_to || null;

  // Build optional date clauses for queries that support date filtering
  const hasDateFilter = dateFrom && dateTo;
  const dateClauseCreatedAt = hasDateFilter
    ? ` AND created_at >= '${dateFrom}'::date AND created_at <= '${dateTo}'::date + INTERVAL '1 day'`
    : '';
  const dateClauseDisbursedAt = hasDateFilter
    ? ` AND disbursed_at >= '${dateFrom}'::date AND disbursed_at <= '${dateTo}'::date + INTERVAL '1 day'`
    : '';
  const dateClausePaymentDate = hasDateFilter
    ? ` AND payment_date >= '${dateFrom}'::date AND payment_date <= '${dateTo}'::date + INTERVAL '1 day'`
    : '';
  const monthStart = hasDateFilter ? `'${dateFrom}'::date` : "date_trunc('month', CURRENT_DATE)";

  // Run all DB queries in parallel for performance
  const [
    customersResult,
    loansResult,
    disbursedResult,
    revenueResult,
    collectionRateResult,
    defaultsResult,
    devicesResult,
    kycResult,
    pendingApprovalsResult,
    newCustomersResult,
    overdueResult,
  ] = await Promise.all([
    // Total active customers
    queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM customers WHERE onboarding_status = $1${dateClauseCreatedAt}`, ['completed']),
    // Active loans and outstanding balance
    queryOne<{ count: string; outstanding: string }>(
      `SELECT COUNT(*) as count, COALESCE(SUM(outstanding_balance_usd), 0) as outstanding FROM loans WHERE status = 'active'${dateClauseCreatedAt}`
    ),
    // Total disbursed
    queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(loan_amount_usd), 0) as total FROM loans WHERE disbursed_at IS NOT NULL${dateClauseDisbursedAt}`
    ),
    // Revenue (completed payments in period)
    queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(amount_usd), 0) as total FROM payments WHERE status = 'confirmed' AND payment_date >= ${monthStart}${hasDateFilter ? ` AND payment_date <= '${dateTo}'::date + INTERVAL '1 day'` : ''}`
    ),
    // Collection rate: completed payments / total expected installments in period
    queryOne<{ collected: string; expected: string }>(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'confirmed' THEN amount_usd ELSE 0 END), 0) as collected,
        COALESCE(SUM(amount_usd), 1) as expected
      FROM payments
      WHERE payment_date >= ${monthStart}${hasDateFilter ? ` AND payment_date <= '${dateTo}'::date + INTERVAL '1 day'` : ''}`
    ),
    // Default rate: defaulted / (active + defaulted)
    queryOne<{ defaulted: string; total_active: string }>(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'defaulted' THEN 1 ELSE 0 END), 0) as defaulted,
        COALESCE(COUNT(*), 1) as total_active
      FROM loans
      WHERE status IN ('active', 'defaulted')`
    ),
    // Device counts
    queryOne<{ in_stock: string; active: string; locked: string }>(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'in_stock' THEN 1 ELSE 0 END), 0) as in_stock,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) as active,
        COALESCE(SUM(CASE WHEN lock_status = 'locked' THEN 1 ELSE 0 END), 0) as locked
      FROM devices`
    ),
    // Pending KYC
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM kyc_submissions WHERE status IN ('pending', 'manual_review')"
    ),
    // Pending loan approvals
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM loans WHERE status = 'pending'"
    ),
    // New customers in period
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM customers WHERE created_at >= ${monthStart}${hasDateFilter ? ` AND created_at <= '${dateTo}'::date + INTERVAL '1 day'` : ''}`
    ),
    // Overdue payments
    queryOne<{ count: string; amount: string }>(
      `SELECT COUNT(*) as count, COALESCE(SUM(outstanding_balance_usd), 0) as amount
      FROM loans WHERE status = 'active' AND days_past_due > 0`
    ),
  ]);

  const totalCustomers = parseInt(customersResult.data?.count || '0');
  const activeLoans = parseInt(loansResult.data?.count || '0');
  const outstandingBalance = parseFloat(loansResult.data?.outstanding || '0');
  const totalDisbursed = parseFloat(disbursedResult.data?.total || '0');
  const monthlyRevenue = parseFloat(revenueResult.data?.total || '0');
  const collected = parseFloat(collectionRateResult.data?.collected || '0');
  const expected = parseFloat(collectionRateResult.data?.expected || '1');
  const collectionRate = expected > 0 ? collected / expected : 0;
  const defaulted = parseInt(defaultsResult.data?.defaulted || '0');
  const totalActiveDefaulted = parseInt(defaultsResult.data?.total_active || '1');
  const defaultRate = totalActiveDefaulted > 0 ? defaulted / totalActiveDefaulted : 0;
  const newCustomersThisMonth = parseInt(newCustomersResult.data?.count || '0');

  // Fineract-enriched fields: read from DB (kept in sync by reconciliation service).
  // Live Fineract API calls are intentionally avoided here — they are serial and
  // can easily exceed the API Gateway 29 s timeout when Fineract is slow or cold.
  const [lastSyncResult, discrepResult, disbResult] = await Promise.all([
    db.from('fineract_sync_log')
      .select('created_at')
      .eq('operation', 'reconcile')
      .order('created_at', { ascending: false })
      .limit(1)
      .execute(),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM fineract_sync_log WHERE operation = 'reconcile' AND status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'"
    ),
    queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(loan_amount_usd), 0) as total FROM loans WHERE disbursed_at >= ${monthStart}${hasDateFilter ? ` AND disbursed_at <= '${dateTo}'::date + INTERVAL '1 day'` : ''}`
    ),
  ]);

  const fineractLastSync = lastSyncResult.data && lastSyncResult.data.length > 0
    ? (lastSyncResult.data[0] as Record<string, unknown>).created_at as string
    : null;
  const fineractDiscrepancies = parseInt(discrepResult.data?.count || '0');
  const disbursementsThisMonth = parseFloat(disbResult.data?.total || '0');

  const avgLoanSize = activeLoans > 0 ? outstandingBalance / activeLoans : 0;

  const metrics = {
    total_customers: totalCustomers,
    active_loans: activeLoans,
    total_disbursed_usd: totalDisbursed,
    outstanding_balance_usd: outstandingBalance,
    collection_rate: collectionRate,
    default_rate: defaultRate,
    devices_in_stock: parseInt(devicesResult.data?.in_stock || '0'),
    devices_active: parseInt(devicesResult.data?.active || '0'),
    devices_locked: parseInt(devicesResult.data?.locked || '0'),
    pending_kyc: parseInt(kycResult.data?.count || '0'),
    pending_approvals: parseInt(pendingApprovalsResult.data?.count || '0'),
    monthly_revenue_usd: monthlyRevenue,
    overdue_payments: parseInt(overdueResult.data?.count || '0'),
    overdue_amount_usd: parseFloat(overdueResult.data?.amount || '0'),
    new_customers_this_month: newCustomersThisMonth,
    // Fineract-enriched fields (sourced from DB — kept in sync by reconciliation service)
    portfolio_outstanding_fineract: outstandingBalance,
    par_30_pct: null,
    avg_loan_size_usd: avgLoanSize,
    disbursements_this_month: disbursementsThisMonth,
    fineract_last_sync: fineractLastSync,
    fineract_discrepancies: fineractDiscrepancies,
  };

  return successResponse(metrics, 200, event);
  } catch (err) {
    logger.error('handleDashboardMetrics failed', {
      action: 'dashboard.metrics',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to load dashboard metrics', 500, undefined, event);
  }
};

/**
 * GET /api/v1/dashboard/portfolio-at-risk
 * Returns PAR aging buckets (0-30, 31-60, 61-90, 90+ days).
 */
export const handlePortfolioAtRisk: RouteHandler = async (event, _params, _auth) => {
  try {
  const { data: rows, error } = await query<{ bucket: string; total: string }>(
    `SELECT
      CASE
        WHEN days_past_due BETWEEN 1 AND 30 THEN 'par_0_30'
        WHEN days_past_due BETWEEN 31 AND 60 THEN 'par_31_60'
        WHEN days_past_due BETWEEN 61 AND 90 THEN 'par_61_90'
        WHEN days_past_due > 90 THEN 'par_90_plus'
      END as bucket,
      COALESCE(SUM(outstanding_balance_usd), 0) as total
    FROM loans
    WHERE status = 'active' AND days_past_due > 0
    GROUP BY bucket`
  );

  if (error) throw error;

  const par: Record<string, number> = {
    par_0_30: 0,
    par_31_60: 0,
    par_61_90: 0,
    par_90_plus: 0,
  };

  for (const row of rows) {
    if (row.bucket && par[row.bucket] !== undefined) {
      par[row.bucket] = parseFloat(row.total);
    }
  }

  return successResponse(par, 200, event);
  } catch (err) {
    logger.error('handlePortfolioAtRisk failed', {
      action: 'dashboard.portfolioAtRisk',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to load portfolio at risk', 500, undefined, event);
  }
};

/**
 * GET /api/v1/dashboard/daily-trends?days=30
 * Returns daily disbursement and collection amounts.
 */
export const handleDailyTrends: RouteHandler = async (event, _params, _auth) => {
  try {
  const qs = event.queryStringParameters || {};
  const days = Math.min(Math.max(parseInt(qs.days || '30'), 1), 365);

  const { data: trends, error } = await query<{
    date: string;
    disbursements: string;
    collections: string;
    new_customers: string;
  }>(
    `WITH dates AS (
      SELECT generate_series(
        CURRENT_DATE - ($1::integer) * INTERVAL '1 day',
        CURRENT_DATE,
        '1 day'
      )::date as d
    )
    SELECT
      dates.d as date,
      COALESCE(SUM(CASE WHEN l.disbursed_at::date = dates.d THEN l.loan_amount_usd ELSE 0 END), 0) as disbursements,
      COALESCE((
        SELECT SUM(p.amount_usd)
        FROM payments p
        WHERE p.status = 'confirmed' AND p.payment_date::date = dates.d
      ), 0) as collections,
      COALESCE((
        SELECT COUNT(*)
        FROM customers c
        WHERE c.created_at::date = dates.d
      ), 0) as new_customers
    FROM dates
    LEFT JOIN loans l ON l.disbursed_at::date = dates.d
    GROUP BY dates.d
    ORDER BY dates.d ASC`,
    [days]
  );

  if (error) throw error;

  const result = trends.map((row) => ({
    date: row.date,
    disbursements: parseFloat(row.disbursements),
    collections: parseFloat(row.collections),
    new_customers: parseInt(row.new_customers),
  }));

  return successResponse(result, 200, event);
  } catch (err) {
    logger.error('handleDailyTrends failed', {
      action: 'dashboard.dailyTrends',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to load daily trends', 500, undefined, event);
  }
};

/**
 * GET /api/v1/dashboard/loans-by-status
 * Returns loan counts and total amounts grouped by status.
 */
export const handleLoansByStatus: RouteHandler = async (event, _params, _auth) => {
  try {
    const { data: rows, error } = await query<{ status: string; count: string; total_amount: string }>(
      `SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(loan_amount_usd), 0) as total_amount
      FROM loans
      GROUP BY status
      ORDER BY count DESC`
    );

    if (error) throw error;

    const result = rows.map((row) => ({
      status: row.status,
      count: parseInt(row.count),
      total_amount: parseFloat(row.total_amount),
    }));

    return successResponse(result, 200, event);
  } catch (err) {
    logger.error('handleLoansByStatus failed', {
      action: 'dashboard.loansByStatus',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to load loans by status', 500, undefined, event);
  }
};

/**
 * GET /api/v1/dashboard/recent-activity?limit=20
 * Returns the most recent audit log entries for the activity feed.
 */
export const handleRecentActivity: RouteHandler = async (event, _params, _auth) => {
  try {
    const qs = event.queryStringParameters || {};
    const limit = Math.min(Math.max(parseInt(qs.limit || '20'), 1), 100);

    const { data: rows, error } = await query<{
      id: string;
      action: string;
      entity_type: string;
      entity_id: string;
      description: string;
      user_email: string;
      created_at: string;
    }>(
      `SELECT id, action, entity_type, entity_id, description, user_email, created_at
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT $1`,
      [limit]
    );

    if (error) throw error;

    const result = rows.map((row) => ({
      id: row.id,
      event_type: mapActionToEventType(row.action || ''),
      description: row.description || `${row.action || 'action'} on ${row.entity_type}`,
      resource_type: row.entity_type,
      resource_id: row.entity_id || '',
      created_at: row.created_at,
      admin_name: row.user_email ? row.user_email.split('@')[0] : undefined,
    }));

    return successResponse(result, 200, event);
  } catch (err) {
    logger.error('handleRecentActivity failed', {
      action: 'dashboard.recentActivity',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to load recent activity', 500, undefined, event);
  }
};
