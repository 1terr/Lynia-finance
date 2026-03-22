/**
 * Distributor Performance Report Handler
 *
 * Ranks distributors by handover count and commission earnings
 * for the admin Reports page "Distributor Performance" tab.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';

// ─── GET /api/v1/reports/distributor-performance/rankings ───

export const handleGetDistributorRankings: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const page = Math.max(1, parseInt(qs.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
    const offset = (page - 1) * limit;
    const sortBy = qs.sort_by === 'commissions' ? 'total_commission' : 'handover_count';

    // Build date filter conditions for handovers and commissions
    const handoverConditions: string[] = ["h.status = 'completed'"];
    const commissionConditions: string[] = [];
    const handoverValues: unknown[] = [];
    const commissionValues: unknown[] = [];
    let hIdx = 1;
    let cIdx = 1;

    if (qs.date_from) {
      handoverConditions.push(`h.completed_at >= $${hIdx++}`);
      handoverValues.push(qs.date_from);
      commissionConditions.push(`dc.created_at >= $${cIdx++}`);
      commissionValues.push(qs.date_from);
    }
    if (qs.date_to) {
      handoverConditions.push(`h.completed_at <= $${hIdx++}`);
      handoverValues.push(qs.date_to);
      commissionConditions.push(`dc.created_at <= $${cIdx++}`);
      commissionValues.push(qs.date_to);
    }

    const handoverWhere = handoverConditions.length > 0
      ? `AND ${handoverConditions.join(' AND ')}`
      : '';
    const commissionWhere = commissionConditions.length > 0
      ? `AND ${commissionConditions.join(' AND ')}`
      : '';

    // Summary query
    const summaryParams = [...handoverValues, ...commissionValues];
    const commissionParamOffset = handoverValues.length;

    const summaryResult = await queryOne<Record<string, string>>(`
      SELECT
        (SELECT COUNT(*) FROM distributors WHERE deleted_at IS NULL) AS total_distributors,
        COALESCE((
          SELECT COUNT(*)
          FROM device_handovers h
          WHERE 1=1 ${handoverWhere}
        ), 0) AS total_handovers,
        COALESCE((
          SELECT SUM(dc.commission_amount_usd)
          FROM distributor_commissions dc
          WHERE 1=1 ${commissionWhere.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + commissionParamOffset}`)}
        ), 0) AS total_commissions
    `, summaryParams);

    const sd = summaryResult.data || {};
    const totalDistributors = parseInt(sd.total_distributors || '0');
    const totalHandovers = parseInt(sd.total_handovers || '0');
    const totalCommissions = parseFloat(sd.total_commissions || '0');

    // Rankings query — combine handovers and commissions per distributor
    // Build parameterized query for rankings
    const rankParams: unknown[] = [];
    let pIdx = 1;

    const rankHandoverConds: string[] = ["h.status = 'completed'"];
    const rankCommissionConds: string[] = [];

    if (qs.date_from) {
      rankHandoverConds.push(`h.completed_at >= $${pIdx}`);
      rankCommissionConds.push(`dc.created_at >= $${pIdx}`);
      rankParams.push(qs.date_from);
      pIdx++;
    }
    if (qs.date_to) {
      rankHandoverConds.push(`h.completed_at <= $${pIdx}`);
      rankCommissionConds.push(`dc.created_at <= $${pIdx}`);
      rankParams.push(qs.date_to);
      pIdx++;
    }

    const rankHandoverWhere = rankHandoverConds.length > 0
      ? `AND ${rankHandoverConds.join(' AND ')}`
      : '';
    const rankCommissionWhere = rankCommissionConds.length > 0
      ? `AND ${rankCommissionConds.join(' AND ')}`
      : '';

    // Count query for pagination
    const countResult = await queryOne<{ count: string }>(`
      SELECT COUNT(*) AS count
      FROM distributors d
      WHERE d.deleted_at IS NULL
    `);
    const total = parseInt(countResult.data?.count || '0');
    const totalPages = Math.ceil(total / limit);

    const limitIdx = pIdx++;
    const offsetIdx = pIdx++;
    rankParams.push(limit, offset);

    const orderCol = sortBy === 'total_commission' ? 'total_commission' : 'handover_count';

    const rankingsResult = await query<Record<string, string>>(`
      SELECT
        d.id AS distributor_id,
        d.business_name,
        d.contact_person,
        COALESCE(d.city, d.province, '') AS location,
        d.status,
        COALESCE(hc.cnt, 0) AS handover_count,
        COALESCE(cc.total, 0) AS total_commission
      FROM distributors d
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM device_handovers h
        WHERE h.distributor_id = d.id ${rankHandoverWhere}
      ) hc ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(dc.commission_amount_usd), 0) AS total
        FROM distributor_commissions dc
        WHERE dc.distributor_id = d.id ${rankCommissionWhere}
      ) cc ON true
      WHERE d.deleted_at IS NULL
      ORDER BY ${orderCol} DESC, d.business_name ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, rankParams);

    if (rankingsResult.error) {
      logger.error('Distributor rankings query failed', {
        action: 'reports.distributor-performance.rankings',
        status: 'failed',
        errorMessage: rankingsResult.error.message,
      });
      return errorResponse('Failed to fetch distributor rankings', 500, {}, event);
    }

    const rankings = rankingsResult.data.map((row, idx) => ({
      rank: offset + idx + 1,
      distributor_id: row.distributor_id,
      business_name: row.business_name || '',
      contact_person: row.contact_person || '',
      location: row.location || '',
      status: row.status || 'active',
      handover_count: parseInt(row.handover_count || '0'),
      total_commission: parseFloat(row.total_commission || '0'),
    }));

    return successResponse({
      summary: {
        total_distributors: totalDistributors,
        total_handovers: totalHandovers,
        total_commissions: totalCommissions,
        avg_handovers_per_distributor: totalDistributors > 0
          ? parseFloat((totalHandovers / totalDistributors).toFixed(1))
          : 0,
      },
      rankings,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch distributor performance rankings', {
      action: 'reports.distributor-performance.rankings',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};
