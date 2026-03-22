/**
 * Device-Loan Chain Report Handler
 *
 * Shows the full device -> customer -> loan -> payment chain.
 * Supports two views:
 *   - collections: overdue loans only, ordered by days_past_due DESC
 *   - audit: all devices with their full lifecycle, ordered by device created_at DESC
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse, getSecurityHeaders } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger, { getRequestContext } from '../../../shared/utils/logger';

/**
 * Escape a value for CSV output.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 * Doubles any internal double quotes per RFC 4180.
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

type ChainView = 'collections' | 'audit';

/** GET /api/v1/reports/device-loan-chain */
export const handleGetDeviceLoanChain: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};

    const view: ChainView = qs.view === 'collections' ? 'collections' : 'audit';
    const search = qs.search?.trim() || '';
    const lockStatus = qs.lock_status || '';
    const loanStatus = qs.loan_status || '';
    const dpdMin = qs.dpd_min ? parseInt(qs.dpd_min, 10) : null;
    const dpdMax = qs.dpd_max ? parseInt(qs.dpd_max, 10) : null;
    const dateFrom = qs.date_from || '';
    const dateTo = qs.date_to || '';
    const page = Math.max(1, parseInt(qs.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25', 10)));
    const offset = (page - 1) * limit;
    const exportCsv = qs.export === 'csv';

    // Build WHERE clauses
    const whereClauses: string[] = ['d.deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIdx = 1;

    // Collections view: only devices linked to overdue loans
    if (view === 'collections') {
      whereClauses.push('l.id IS NOT NULL');
      whereClauses.push('l.days_past_due > 0');
      whereClauses.push("l.status NOT IN ('paid_off', 'cancelled', 'rejected')");
    }

    if (lockStatus) {
      whereClauses.push(`d.lock_status = $${paramIdx++}`);
      params.push(lockStatus);
    }

    if (loanStatus) {
      whereClauses.push(`l.status = $${paramIdx++}`);
      params.push(loanStatus);
    }

    if (dpdMin !== null && !isNaN(dpdMin)) {
      whereClauses.push(`COALESCE(l.days_past_due, 0) >= $${paramIdx++}`);
      params.push(dpdMin);
    }

    if (dpdMax !== null && !isNaN(dpdMax)) {
      whereClauses.push(`COALESCE(l.days_past_due, 0) <= $${paramIdx++}`);
      params.push(dpdMax);
    }

    if (dateFrom) {
      whereClauses.push(`d.created_at >= $${paramIdx++}`);
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClauses.push(`d.created_at <= ($${paramIdx++}::date + INTERVAL '1 day')`);
      params.push(dateTo);
    }

    if (search) {
      const normalized = search.replace(/[-\s]/g, '');
      const searchParam = `%${search}%`;
      const normalizedParam = `%${normalized}%`;
      whereClauses.push(`(
        d.imei ILIKE $${paramIdx++}
        OR c.first_name ILIKE $${paramIdx++}
        OR c.last_name ILIKE $${paramIdx++}
        OR CONCAT(c.first_name, ' ', c.last_name) ILIKE $${paramIdx++}
        OR REPLACE(REPLACE(COALESCE(c.national_id, ''), '-', ''), ' ', '') ILIKE $${paramIdx++}
        OR l.loan_number ILIKE $${paramIdx++}
      )`);
      params.push(searchParam, searchParam, searchParam, searchParam, normalizedParam, searchParam);
    }

    const whereClause = whereClauses.join(' AND ');

    const orderBy = view === 'collections'
      ? 'l.days_past_due DESC NULLS LAST, d.created_at DESC'
      : 'd.created_at DESC';

    // Base SELECT for both data and count
    const fromJoins = `
      FROM devices d
      LEFT JOIN device_models dm ON dm.id = d.device_model_id
      LEFT JOIN loans l ON l.id = d.loan_id AND l.status NOT IN ('cancelled', 'rejected')
      LEFT JOIN customers c ON c.id = COALESCE(l.customer_id, d.customer_id)
      LEFT JOIN LATERAL (
        SELECT
          p.status AS last_payment_status,
          p.payment_date AS last_payment_date
        FROM payments p
        WHERE p.loan_id = l.id
        ORDER BY p.payment_date DESC
        LIMIT 1
      ) lp ON l.id IS NOT NULL
    `;

    // Count query
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count ${fromJoins} WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.data?.count || '0', 10);

    // Data query
    const dataParams = [...params, limit, offset];
    const dataResult = await query<{
      device_id: string;
      imei: string;
      manufacturer: string;
      model: string;
      lock_status: string;
      device_status: string;
      customer_id: string | null;
      customer_name: string | null;
      phone_number: string | null;
      national_id: string | null;
      loan_id: string | null;
      loan_number: string | null;
      loan_status: string | null;
      loan_amount_usd: number | null;
      outstanding_balance_usd: number | null;
      days_past_due: number | null;
      last_payment_date: string | null;
      last_payment_status: string | null;
      device_created_at: string;
    }>(`
      SELECT
        d.id AS device_id,
        d.imei,
        COALESCE(dm.manufacturer, d.manufacturer, '') AS manufacturer,
        COALESCE(dm.model_name, d.model, '') AS model,
        COALESCE(d.lock_status, 'unknown') AS lock_status,
        d.status AS device_status,
        c.id AS customer_id,
        CASE WHEN c.id IS NOT NULL THEN CONCAT(c.first_name, ' ', c.last_name) ELSE NULL END AS customer_name,
        c.phone_number,
        c.national_id,
        l.id AS loan_id,
        l.loan_number,
        l.status AS loan_status,
        l.loan_amount_usd,
        l.outstanding_balance_usd,
        COALESCE(l.days_past_due, 0) AS days_past_due,
        lp.last_payment_date,
        lp.last_payment_status,
        d.created_at AS device_created_at
      ${fromJoins}
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, dataParams);

    if (dataResult.error) {
      logger.error('Device-loan chain query failed', {
        action: 'reports.device-loan-chain',
        status: 'failed',
        errorMessage: dataResult.error.message,
      });
      return errorResponse('Failed to fetch device-loan chain', 500, {
        requestId: getRequestContext()?.requestId,
        timestamp: new Date().toISOString(),
      }, event);
    }

    // CSV export
    if (exportCsv) {
      const headers = [
        'IMEI', 'Manufacturer', 'Model', 'Lock Status', 'Device Status',
        'Customer Name', 'Phone', 'National ID',
        'Loan Number', 'Loan Status', 'Loan Amount (USD)', 'Outstanding Balance (USD)',
        'Days Past Due', 'Last Payment Date', 'Last Payment Status',
      ];

      const csvLines: string[] = [headers.join(',')];
      for (const row of dataResult.data) {
        csvLines.push([
          escapeCsvValue(row.imei),
          escapeCsvValue(row.manufacturer),
          escapeCsvValue(row.model),
          escapeCsvValue(row.lock_status),
          escapeCsvValue(row.device_status),
          escapeCsvValue(row.customer_name),
          escapeCsvValue(row.phone_number),
          escapeCsvValue(row.national_id),
          escapeCsvValue(row.loan_number),
          escapeCsvValue(row.loan_status),
          escapeCsvValue(row.loan_amount_usd),
          escapeCsvValue(row.outstanding_balance_usd),
          escapeCsvValue(row.days_past_due),
          escapeCsvValue(row.last_payment_date),
          escapeCsvValue(row.last_payment_status),
        ].join(','));
      }

      const csvContent = csvLines.join('\n');
      const today = new Date().toISOString().slice(0, 10);
      const securityHeaders = getSecurityHeaders(event);

      return {
        statusCode: 200,
        headers: {
          ...securityHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=device-loan-chain-${view}-${today}.csv`,
        },
        body: csvContent,
      };
    }

    return successResponse({
      data: dataResult.data,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      view,
      generated_at: new Date().toISOString(),
    }, 200, event);
  } catch (err) {
    logger.error('Device-loan chain report failed', {
      action: 'reports.device-loan-chain',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to generate device-loan chain report', 500, {
      requestId: getRequestContext()?.requestId,
      timestamp: new Date().toISOString(),
    }, event);
  }
};
