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
       d.assigned_to_distributor_at AS received_at
     FROM devices d
     WHERE d.distributor_id = $1
       AND d.status NOT IN ('sold')
     ORDER BY d.assigned_to_distributor_at DESC`,
    [dist.id]
  );

  return successResponse(result.data, 200, event);
};
