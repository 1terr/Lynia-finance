import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import { successResponse, notFoundResponse } from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';

/**
 * GET /api/v1/distributor/commissions
 */
export const handleGetCommissions: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor');

  const { data: dist } = await db
    .from('distributors')
    .select('id')
    .eq('user_id', auth.userId)
    .single()
    .execute();

  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const result = await query(
    `SELECT
       dc.id,
       dc.loan_id,
       CONCAT(d.manufacturer, ' ', d.model) AS device_model,
       c.full_name AS customer_name,
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

  return successResponse(result.rows, 200, event);
};
