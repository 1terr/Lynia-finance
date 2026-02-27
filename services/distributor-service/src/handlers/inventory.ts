import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query } from '../../../shared/clients/database';
import { successResponse, notFoundResponse } from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';
import { resolveDistributor } from '../helpers/resolve-distributor';

/**
 * GET /api/v1/distributor/inventory
 */
export const handleGetInventory: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const dist = await resolveDistributor(auth, event);

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
       CASE
         WHEN d.status IN ('in_stock', 'assigned') THEN 'available'
         WHEN d.status = 'reserved' THEN 'reserved'
         WHEN d.status = 'damaged' THEN 'damaged'
         ELSE 'available'
       END AS status,
       d.condition,
       d.storage_gb,
       d.color,
       ai.assigned_date AS received_at
     FROM devices d
     JOIN agent_inventory ai ON ai.device_id = d.id
     WHERE ai.distributor_id = $1
       AND ai.status != 'sold'
     ORDER BY ai.assigned_date DESC`,
    [dist.id]
  );

  return successResponse(result.data, 200, event);
};
