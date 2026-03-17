/**
 * Reports Handlers
 *
 * Read-only SQL aggregation endpoints for the admin Reports page.
 * Each handler queries against loans, payments, customers, kyc_submissions,
 * devices, and credit_scores tables, returning summary/aggregated data.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';

// ─── Shared filter builder ───

function _buildDateFilters(qs: Record<string, string | undefined>, paramIdx: number) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = paramIdx;

  if (qs.date_from) {
    conditions.push(`created_at >= $${idx++}`);
    values.push(qs.date_from);
  }
  if (qs.date_to) {
    conditions.push(`created_at <= $${idx++}`);
    values.push(qs.date_to);
  }
  return { conditions, values, paramIdx: idx };
}

// ─── GET /api/v1/reports/portfolio ───

export const handleGetPortfolioReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const result = await queryOne<{
      total_outstanding: string;
      current: string;
      par_30: string;
      par_60: string;
      par_90: string;
      par_90_plus: string;
      total_loans: string;
    }>(`SELECT
      COALESCE(SUM(outstanding_balance_usd), 0) AS total_outstanding,
      COALESCE(SUM(CASE WHEN days_past_due = 0 OR days_past_due IS NULL THEN outstanding_balance_usd ELSE 0 END), 0) AS current,
      COALESCE(SUM(CASE WHEN days_past_due BETWEEN 1 AND 30 THEN outstanding_balance_usd ELSE 0 END), 0) AS par_30,
      COALESCE(SUM(CASE WHEN days_past_due BETWEEN 31 AND 60 THEN outstanding_balance_usd ELSE 0 END), 0) AS par_60,
      COALESCE(SUM(CASE WHEN days_past_due BETWEEN 61 AND 90 THEN outstanding_balance_usd ELSE 0 END), 0) AS par_90,
      COALESCE(SUM(CASE WHEN days_past_due > 90 THEN outstanding_balance_usd ELSE 0 END), 0) AS par_90_plus,
      COUNT(*) AS total_loans
    FROM loans
    WHERE status IN ('active', 'disbursed')`);

    return successResponse({
      total_outstanding: parseFloat(result.data?.total_outstanding || '0'),
      current: parseFloat(result.data?.current || '0'),
      par_30: parseFloat(result.data?.par_30 || '0'),
      par_60: parseFloat(result.data?.par_60 || '0'),
      par_90: parseFloat(result.data?.par_90 || '0'),
      par_90_plus: parseFloat(result.data?.par_90_plus || '0'),
      total_loans: parseInt(result.data?.total_loans || '0'),
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch portfolio report', {
      action: 'reports.portfolio', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── GET /api/v1/reports/portfolio/health ───

export const handleGetPortfolioHealthReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};

    const conditions: string[] = ["l.status IN ('active', 'disbursed')"];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.product) {
      conditions.push(`l.product_id = $${paramIdx++}`);
      values.push(qs.product);
    }
    if (qs.distributor) {
      conditions.push(`l.distributor_id = $${paramIdx++}`);
      values.push(qs.distributor);
    }
    if (qs.tier) {
      conditions.push(`cs.tier = $${paramIdx++}`);
      values.push(qs.tier);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await queryOne<Record<string, string>>(`SELECT
      COALESCE(SUM(l.outstanding_balance_usd), 0) AS total_outstanding,
      COALESCE(SUM(l.loan_amount_usd), 0) AS total_disbursed,
      COALESCE(SUM(CASE WHEN l.days_past_due BETWEEN 1 AND 30 THEN l.outstanding_balance_usd ELSE 0 END), 0) AS par_1_30,
      COALESCE(SUM(CASE WHEN l.days_past_due BETWEEN 31 AND 60 THEN l.outstanding_balance_usd ELSE 0 END), 0) AS par_31_60,
      COALESCE(SUM(CASE WHEN l.days_past_due BETWEEN 61 AND 90 THEN l.outstanding_balance_usd ELSE 0 END), 0) AS par_61_90,
      COALESCE(SUM(CASE WHEN l.days_past_due > 90 THEN l.outstanding_balance_usd ELSE 0 END), 0) AS par_90_plus,
      COUNT(*) AS total_loans,
      COUNT(*) FILTER (WHERE l.days_past_due > 0) AS delinquent_loans
    FROM loans l
    LEFT JOIN LATERAL (
      SELECT tier FROM credit_scores WHERE customer_id = l.customer_id ORDER BY calculated_at DESC LIMIT 1
    ) cs ON true
    ${whereClause}`, values);

    const d = result.data || {};
    const totalOutstanding = parseFloat(d.total_outstanding || '0');

    return successResponse({
      total_outstanding: totalOutstanding,
      total_disbursed: parseFloat(d.total_disbursed || '0'),
      par_1_30: parseFloat(d.par_1_30 || '0'),
      par_31_60: parseFloat(d.par_31_60 || '0'),
      par_61_90: parseFloat(d.par_61_90 || '0'),
      par_90_plus: parseFloat(d.par_90_plus || '0'),
      collection_efficiency: totalOutstanding > 0
        ? ((parseFloat(d.total_disbursed || '0') - totalOutstanding) / parseFloat(d.total_disbursed || '1')) * 100
        : 0,
      total_loans: parseInt(d.total_loans || '0'),
      delinquent_loans: parseInt(d.delinquent_loans || '0'),
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch portfolio health report', {
      action: 'reports.portfolio.health', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── GET /api/v1/reports/disbursements ───

export const handleGetDisbursementReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.date_from) {
      conditions.push(`l.disbursed_at >= $${paramIdx++}`);
      values.push(qs.date_from);
    }
    if (qs.date_to) {
      conditions.push(`l.disbursed_at <= $${paramIdx++}`);
      values.push(qs.date_to);
    }
    if (qs.product) {
      conditions.push(`l.product_id = $${paramIdx++}`);
      values.push(qs.product);
    }
    if (qs.status) {
      conditions.push(`l.status = $${paramIdx++}`);
      values.push(qs.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await queryOne<Record<string, string>>(`SELECT
      COUNT(*) AS total_applications,
      COUNT(*) FILTER (WHERE status = 'disbursed' OR status = 'active') AS approved,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COALESCE(SUM(CASE WHEN status IN ('disbursed', 'active') THEN loan_amount_usd ELSE 0 END), 0) AS total_disbursed,
      COALESCE(AVG(CASE WHEN status IN ('disbursed', 'active') THEN loan_amount_usd END), 0) AS avg_loan_size
    FROM loans l ${whereClause}`, values);

    const d = result.data || {};
    const total = parseInt(d.total_applications || '0');
    const approved = parseInt(d.approved || '0');

    return successResponse({
      total_applications: total,
      approved,
      rejected: parseInt(d.rejected || '0'),
      pending: parseInt(d.pending || '0'),
      total_disbursed: parseFloat(d.total_disbursed || '0'),
      avg_loan_size: parseFloat(d.avg_loan_size || '0'),
      approval_rate: total > 0 ? (approved / total) * 100 : 0,
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch disbursement report', {
      action: 'reports.disbursements', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── GET /api/v1/reports/collections ───

export const handleGetCollectionReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const conditions: string[] = ["p.status = 'confirmed'"];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.date_from) {
      conditions.push(`p.payment_date >= $${paramIdx++}`);
      values.push(qs.date_from);
    }
    if (qs.date_to) {
      conditions.push(`p.payment_date <= $${paramIdx++}`);
      values.push(qs.date_to);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await query<{ method: string; count: string; total_amount: string }>(
      `SELECT
        payment_method AS method,
        COUNT(*) AS count,
        COALESCE(SUM(amount_usd), 0) AS total_amount
      FROM payments p
      ${whereClause}
      GROUP BY payment_method
      ORDER BY total_amount DESC`,
      values
    );

    if (result.error) {
      logger.error('Collection report query failed', {
        action: 'reports.collections', status: 'failed',
        errorMessage: result.error.message,
      });
      return errorResponse('Failed to fetch collection report', 500, {}, event);
    }

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to fetch collection report', {
      action: 'reports.collections', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── GET /api/v1/reports/collections/detailed ───

export const handleGetCollectionDetailedReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.date_from) {
      conditions.push(`p.payment_date >= $${paramIdx++}`);
      values.push(qs.date_from);
    }
    if (qs.date_to) {
      conditions.push(`p.payment_date <= $${paramIdx++}`);
      values.push(qs.date_to);
    }
    if (qs.payment_method) {
      conditions.push(`p.payment_method = $${paramIdx++}`);
      values.push(qs.payment_method);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await queryOne<Record<string, string>>(`SELECT
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN amount_usd ELSE 0 END), 0) AS total_collected,
      COUNT(*) AS total_payments,
      COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_count,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
    FROM payments p ${whereClause}`, values);

    const d = result.data || {};
    const total = parseInt(d.total_payments || '0');
    const confirmed = parseInt(d.confirmed_count || '0');

    return successResponse({
      total_collected: parseFloat(d.total_collected || '0'),
      total_payments: total,
      confirmed_count: confirmed,
      failed_count: parseInt(d.failed_count || '0'),
      pending_count: parseInt(d.pending_count || '0'),
      collection_rate: total > 0 ? (confirmed / total) * 100 : 0,
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch detailed collection report', {
      action: 'reports.collections.detailed', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── GET /api/v1/reports/kyc ───

export const handleGetKYCReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const result = await queryOne<Record<string, string>>(`SELECT
      COUNT(*) AS total_submissions,
      COUNT(*) FILTER (WHERE status = 'pending' OR status = 'in_review') AS pending,
      COUNT(*) FILTER (WHERE status = 'approved' OR status = 'verified') AS approved,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
      COALESCE(AVG(
        CASE WHEN status IN ('approved', 'verified', 'rejected')
        THEN EXTRACT(EPOCH FROM (updated_at - submitted_at)) / 3600
        END
      ), 0) AS avg_processing_time_hours
    FROM kyc_submissions`);

    const d = result.data || {};
    return successResponse({
      total_submissions: parseInt(d.total_submissions || '0'),
      pending: parseInt(d.pending || '0'),
      approved: parseInt(d.approved || '0'),
      rejected: parseInt(d.rejected || '0'),
      avg_processing_time_hours: parseFloat(parseFloat(d.avg_processing_time_hours || '0').toFixed(1)),
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch KYC report', {
      action: 'reports.kyc', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── GET /api/v1/reports/kyc/detailed ───

export const handleGetKYCDetailedReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.date_from) {
      conditions.push(`submitted_at >= $${paramIdx++}`);
      values.push(qs.date_from);
    }
    if (qs.date_to) {
      conditions.push(`submitted_at <= $${paramIdx++}`);
      values.push(qs.date_to);
    }
    if (qs.status) {
      conditions.push(`status = $${paramIdx++}`);
      values.push(qs.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await queryOne<Record<string, string>>(`SELECT
      COUNT(*) AS total_submissions,
      COUNT(*) FILTER (WHERE status = 'pending' OR status = 'in_review') AS pending,
      COUNT(*) FILTER (WHERE status = 'approved' OR status = 'verified') AS approved,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
      COALESCE(AVG(
        CASE WHEN status IN ('approved', 'verified', 'rejected')
        THEN EXTRACT(EPOCH FROM (updated_at - submitted_at)) / 3600
        END
      ), 0) AS avg_processing_time_hours
    FROM kyc_submissions ${whereClause}`, values);

    const d = result.data || {};
    return successResponse({
      total_submissions: parseInt(d.total_submissions || '0'),
      pending: parseInt(d.pending || '0'),
      approved: parseInt(d.approved || '0'),
      rejected: parseInt(d.rejected || '0'),
      avg_processing_time_hours: parseFloat(parseFloat(d.avg_processing_time_hours || '0').toFixed(1)),
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch KYC detailed report', {
      action: 'reports.kyc.detailed', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── GET /api/v1/reports/defaults ───

export const handleGetDefaultReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const result = await query(
      `SELECT
        l.id AS loan_id,
        l.customer_id,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        c.phone_number AS customer_phone,
        l.loan_amount_usd,
        l.outstanding_balance_usd,
        l.days_past_due,
        l.disbursed_at AS disbursement_date,
        NULL::date AS maturity_date
      FROM loans l
      JOIN customers c ON c.id = l.customer_id
      WHERE l.days_past_due > 0
        AND l.status IN ('active', 'disbursed')
      ORDER BY l.days_past_due DESC
      LIMIT 500`
    );

    if (result.error) {
      logger.error('Default report query failed', {
        action: 'reports.defaults', status: 'failed',
        errorMessage: result.error.message,
      });
      return errorResponse('Failed to fetch default report', 500, {}, event);
    }

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to fetch default report', {
      action: 'reports.defaults', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── GET /api/v1/reports/defaults/summary ───

export const handleGetDefaultSummaryReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const conditions: string[] = ["l.status IN ('active', 'disbursed')"];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.date_from) {
      conditions.push(`l.created_at >= $${paramIdx++}`);
      values.push(qs.date_from);
    }
    if (qs.date_to) {
      conditions.push(`l.created_at <= $${paramIdx++}`);
      values.push(qs.date_to);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await queryOne<Record<string, string>>(`SELECT
      COUNT(*) AS total_loans,
      COUNT(*) FILTER (WHERE days_past_due > 30) AS par_30_count,
      COUNT(*) FILTER (WHERE days_past_due > 60) AS par_60_count,
      COUNT(*) FILTER (WHERE days_past_due > 90) AS par_90_count,
      COALESCE(SUM(outstanding_balance_usd), 0) AS total_outstanding,
      COALESCE(SUM(CASE WHEN days_past_due > 0 THEN outstanding_balance_usd ELSE 0 END), 0) AS total_at_risk
    FROM loans l ${whereClause}`, values);

    const d = result.data || {};
    const totalLoans = parseInt(d.total_loans || '0');
    const totalOutstanding = parseFloat(d.total_outstanding || '0');
    const totalAtRisk = parseFloat(d.total_at_risk || '0');

    return successResponse({
      par_30: totalLoans > 0 ? (parseInt(d.par_30_count || '0') / totalLoans) * 100 : 0,
      par_60: totalLoans > 0 ? (parseInt(d.par_60_count || '0') / totalLoans) * 100 : 0,
      par_90: totalLoans > 0 ? (parseInt(d.par_90_count || '0') / totalLoans) * 100 : 0,
      default_rate: totalOutstanding > 0 ? (totalAtRisk / totalOutstanding) * 100 : 0,
      total_loans: totalLoans,
      total_outstanding: totalOutstanding,
      total_at_risk: totalAtRisk,
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch default summary report', {
      action: 'reports.defaults.summary', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── GET /api/v1/reports/acquisition ───

export const handleGetAcquisitionReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const conditions: string[] = ['deleted_at IS NULL'];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.date_from) {
      conditions.push(`created_at >= $${paramIdx++}`);
      values.push(qs.date_from);
    }
    if (qs.date_to) {
      conditions.push(`created_at <= $${paramIdx++}`);
      values.push(qs.date_to);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await queryOne<Record<string, string>>(`SELECT
      COUNT(*) AS total_customers,
      COUNT(*) FILTER (WHERE kyc_status = 'verified' OR kyc_status = 'approved') AS kyc_completed,
      COUNT(*) FILTER (WHERE kyc_status = 'pending') AS kyc_pending,
      COUNT(*) FILTER (WHERE kyc_status = 'rejected') AS kyc_rejected,
      COUNT(*) FILTER (WHERE status = 'active') AS active_customers
    FROM customers ${whereClause}`, values);

    const d = result.data || {};
    const total = parseInt(d.total_customers || '0');
    const completed = parseInt(d.kyc_completed || '0');

    return successResponse({
      total_customers: total,
      kyc_completed: completed,
      kyc_pending: parseInt(d.kyc_pending || '0'),
      kyc_rejected: parseInt(d.kyc_rejected || '0'),
      active_customers: parseInt(d.active_customers || '0'),
      completion_rate: total > 0 ? (completed / total) * 100 : 0,
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch acquisition report', {
      action: 'reports.acquisition', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── GET /api/v1/reports/revenue ───

export const handleGetRevenueReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const conditions: string[] = ["status = 'confirmed'"];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.date_from) {
      conditions.push(`payment_date >= $${paramIdx++}`);
      values.push(qs.date_from);
    }
    if (qs.date_to) {
      conditions.push(`payment_date <= $${paramIdx++}`);
      values.push(qs.date_to);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await query<{ month: string; total: string; count: string }>(
      `SELECT
        TO_CHAR(payment_date, 'YYYY-MM') AS month,
        COALESCE(SUM(amount_usd), 0) AS total,
        COUNT(*) AS count
      FROM payments
      ${whereClause}
      GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 24`,
      values
    );

    if (result.error) {
      logger.error('Revenue report query failed', {
        action: 'reports.revenue', status: 'failed',
        errorMessage: result.error.message,
      });
      return errorResponse('Failed to fetch revenue report', 500, {}, event);
    }

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to fetch revenue report', {
      action: 'reports.revenue', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── GET /api/v1/reports/loan-approvals ───

export const handleGetLoanApprovalReport: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.date_from) {
      conditions.push(`created_at >= $${paramIdx++}`);
      values.push(qs.date_from);
    }
    if (qs.date_to) {
      conditions.push(`created_at <= $${paramIdx++}`);
      values.push(qs.date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await queryOne<Record<string, string>>(`SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status IN ('approved', 'disbursed', 'active', 'closed', 'completed')) AS approved,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE approval_status = 'auto_approved') AS auto_approved
    FROM loans ${whereClause}`, values);

    const d = result.data || {};
    return successResponse({
      total: parseInt(d.total || '0'),
      approved: parseInt(d.approved || '0'),
      rejected: parseInt(d.rejected || '0'),
      pending: parseInt(d.pending || '0'),
      auto_approved: parseInt(d.auto_approved || '0'),
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch loan approval report', {
      action: 'reports.loan-approvals', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};
