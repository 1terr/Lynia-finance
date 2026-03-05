import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query } from '../../../shared/clients/database';
import { successResponse, notFoundResponse } from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';
import { resolveDistributor } from '../helpers/resolve-distributor';

/**
 * GET /api/v1/distributor/commissions
 */
export const handleGetCommissions: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const dist = await resolveDistributor(auth, event);

  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

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
     FROM distributor_commissions dc
     JOIN loans l ON l.id = dc.loan_id
     JOIN devices dev ON dev.id = dc.device_id
     JOIN customers c ON c.id = l.customer_id
     JOIN devices d ON d.id = dc.device_id
     WHERE dc.distributor_id = $1
     ORDER BY dc.calculation_date DESC`,
    [dist.id]
  );

  // PostgreSQL DECIMAL columns return strings via the pg driver.
  // Convert to numbers so the frontend can call .toFixed() safely.
  const commissions = result.data.map((row: Record<string, unknown>) => ({
    ...row,
    commission_amount: Number(row.commission_amount) || 0,
    commission_percentage: Number(row.commission_percentage) || 0,
    device_retail_price: Number(row.device_retail_price) || 0,
  }));

  return successResponse(commissions, 200, event);
};
