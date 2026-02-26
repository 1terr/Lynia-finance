import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import { successResponse, notFoundResponse } from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';

/**
 * GET /api/v1/distributor/inventory
 */
export const handleGetInventory: RouteHandler = async (event, _params, auth) => {
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
       d.id,
       d.manufacturer AS brand,
       d.model,
       d.imei,
       d.retail_price_usd AS retail_price,
       d.status,
       d.condition,
       ai.received_at
     FROM devices d
     JOIN agent_inventory ai ON ai.device_id = d.id
     WHERE ai.distributor_id = $1
       AND ai.status != 'sold'
     ORDER BY ai.received_at DESC`,
    [dist.id]
  );

  return successResponse(result.rows, 200, event);
};
