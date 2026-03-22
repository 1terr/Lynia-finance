import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, notFoundResponse } from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';
import { resolveDistributor } from '../helpers/resolve-distributor';

/**
 * GET /api/v1/distributor/commissions
 *
 * Supports search, status filter, date range, and pagination.
 */
export const handleGetCommissions: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const dist = await resolveDistributor(auth, event);

  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['dc.distributor_id = $1'];
  const values: unknown[] = [dist.id];
  let paramIdx = 2;

  if (qs.status) {
    conditions.push(`dc.payment_status = $${paramIdx++}`);
    values.push(qs.status);
  }

  if (qs.date_from) {
    conditions.push(`dc.calculation_date >= $${paramIdx++}`);
    values.push(qs.date_from);
  }

  if (qs.date_to) {
    conditions.push(`dc.calculation_date <= $${paramIdx++}`);
    values.push(qs.date_to);
  }

  if (qs.search) {
    const term = `%${qs.search}%`;
    conditions.push(
      `(c.first_name ILIKE $${paramIdx} OR c.last_name ILIKE $${paramIdx} OR dc.loan_id::text ILIKE $${paramIdx} OR CONCAT(d.manufacturer, ' ', d.model) ILIKE $${paramIdx})`
    );
    paramIdx++;
    values.push(term);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const fromClause = `FROM distributor_commissions dc
     JOIN loans l ON l.id = dc.loan_id
     JOIN customers c ON c.id = l.customer_id
     JOIN devices d ON d.id = dc.device_id`;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count ${fromClause} ${whereClause}`,
    values
  );
  const total = parseInt(countResult.data?.count || '0');

  values.push(limit, offset);
  const result = await query(
    `SELECT
       dc.id,
       dc.loan_id,
       CONCAT(d.manufacturer, ' ', d.model) AS device_model,
       CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
       dc.device_retail_price_usd AS device_retail_price,
       dc.commission_percentage,
       dc.commission_amount_usd AS commission_amount,
       dc.payment_status,
       dc.calculation_date,
       dc.paid_at
     ${fromClause}
     ${whereClause}
     ORDER BY dc.calculation_date DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    values
  );

  // PostgreSQL DECIMAL columns return strings via the pg driver.
  // Convert to numbers so the frontend can call .toFixed() safely.
  const commissions = result.data.map((row: Record<string, unknown>) => ({
    ...row,
    commission_amount: Number(row.commission_amount) || 0,
    commission_percentage: Number(row.commission_percentage) || 0,
    device_retail_price: Number(row.device_retail_price) || 0,
  }));

  return successResponse({
    data: commissions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }, 200, event);
};
