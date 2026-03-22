/**
 * Commission Reports Handlers
 *
 * System-wide commission overview for the admin Reports page.
 * Aggregates distributor_commissions data joined with distributors.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';

// ─── GET /api/v1/reports/commissions/overview ───

export const handleGetCommissionOverview: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const page = Math.max(1, parseInt(qs.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
    const offset = (page - 1) * limit;

    // ── Build date filter conditions ──
    const summaryConditions: string[] = [];
    const summaryValues: unknown[] = [];
    let summaryIdx = 1;

    if (qs.date_from) {
      summaryConditions.push(`dc.created_at >= $${summaryIdx++}`);
      summaryValues.push(qs.date_from);
    }
    if (qs.date_to) {
      summaryConditions.push(`dc.created_at <= $${summaryIdx++}`);
      summaryValues.push(qs.date_to);
    }

    const summaryWhere = summaryConditions.length > 0
      ? `WHERE ${summaryConditions.join(' AND ')}`
      : '';

    // ── System-wide summary ──
    const summaryResult = await queryOne<Record<string, string>>(
      `SELECT
        COALESCE(SUM(dc.commission_amount_usd), 0) AS total_earned,
        COALESCE(SUM(dc.commission_amount_usd) FILTER (WHERE dc.payment_status = 'paid'), 0) AS total_paid,
        COALESCE(SUM(dc.commission_amount_usd) FILTER (WHERE dc.payment_status != 'paid'), 0) AS total_pending,
        COUNT(DISTINCT dc.distributor_id) AS distributor_count,
        COUNT(*) AS total_handovers
      FROM distributor_commissions dc
      ${summaryWhere}`,
      summaryValues
    );

    const s = summaryResult.data || {};

    // ── Per-distributor breakdown ──
    // Rebuild conditions for the grouped query (same date filters)
    const distConditions: string[] = [];
    const distValues: unknown[] = [];
    let distIdx = 1;

    if (qs.date_from) {
      distConditions.push(`dc.created_at >= $${distIdx++}`);
      distValues.push(qs.date_from);
    }
    if (qs.date_to) {
      distConditions.push(`dc.created_at <= $${distIdx++}`);
      distValues.push(qs.date_to);
    }

    const distWhere = distConditions.length > 0
      ? `WHERE ${distConditions.join(' AND ')}`
      : '';

    // Count total distributors with commissions (for pagination)
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(DISTINCT dc.distributor_id) AS count
       FROM distributor_commissions dc
       ${distWhere}`,
      distValues
    );
    const total = parseInt(countResult.data?.count || '0');

    // Paginated distributor breakdown
    const breakdownValues = [...distValues, limit, offset];
    const breakdownResult = await query<{
      id: string;
      business_name: string;
      location: string;
      handover_count: string;
      total_earned: string;
      total_paid: string;
      total_pending: string;
    }>(
      `SELECT
        d.id,
        d.business_name,
        COALESCE(d.city, d.province, '') AS location,
        COUNT(dc.id) AS handover_count,
        COALESCE(SUM(dc.commission_amount_usd), 0) AS total_earned,
        COALESCE(SUM(dc.commission_amount_usd) FILTER (WHERE dc.payment_status = 'paid'), 0) AS total_paid,
        COALESCE(SUM(dc.commission_amount_usd) FILTER (WHERE dc.payment_status != 'paid'), 0) AS total_pending
      FROM distributor_commissions dc
      JOIN distributors d ON d.id = dc.distributor_id
      ${distWhere}
      GROUP BY d.id, d.business_name, d.city, d.province
      ORDER BY total_earned DESC
      LIMIT $${distIdx++} OFFSET $${distIdx++}`,
      breakdownValues
    );

    if (breakdownResult.error) {
      logger.error('Commission overview breakdown query failed', {
        action: 'reports.commissions.overview', status: 'failed',
        errorMessage: breakdownResult.error.message,
      });
      return errorResponse('Failed to fetch commission overview', 500, {}, event);
    }

    const distributors = breakdownResult.data.map((row) => ({
      id: row.id,
      business_name: row.business_name,
      location: row.location,
      handover_count: parseInt(row.handover_count || '0'),
      total_earned: parseFloat(row.total_earned || '0'),
      total_paid: parseFloat(row.total_paid || '0'),
      total_pending: parseFloat(row.total_pending || '0'),
    }));

    const totalPages = Math.ceil(total / limit);

    return successResponse({
      summary: {
        total_earned: parseFloat(s.total_earned || '0'),
        total_paid: parseFloat(s.total_paid || '0'),
        total_pending: parseFloat(s.total_pending || '0'),
        distributor_count: parseInt(s.distributor_count || '0'),
        total_handovers: parseInt(s.total_handovers || '0'),
      },
      distributors,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch commission overview', {
      action: 'reports.commissions.overview', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};
