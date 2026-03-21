/**
 * Distributor Device Movement History
 *
 * Allows distributors to view the movement history for a specific device
 * that belongs to them. Validates ownership via distributor_id check.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, notFoundResponse, errorResponse } from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';
import { resolveDistributor } from '../helpers/resolve-distributor';

/**
 * GET /api/v1/distributor/devices/:id/movements
 * Returns paginated movement history for a device belonging to the distributor.
 */
export const handleGetDeviceMovements: RouteHandler = async (event, params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const dist = await resolveDistributor(auth, event);
  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const deviceId = params.id;
  if (!deviceId) {
    return errorResponse('Device ID is required', 400, undefined, event);
  }

  // Verify the device belongs to this distributor
  const device = await queryOne<{ id: string }>(
    `SELECT id FROM devices
     WHERE id = $1 AND distributor_id = $2 AND deleted_at IS NULL`,
    [deviceId, dist.id]
  );

  if (device.error || !device.data) {
    return notFoundResponse('Device', event);
  }

  // Parse pagination params
  const queryParams = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const offset = (page - 1) * limit;

  // Count total movements for pagination
  const countResult = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM inventory_movements WHERE device_id = $1`,
    [deviceId]
  );
  const total = parseInt(countResult.data?.total || '0', 10);

  // Fetch movement history
  const movements = await query<{
    id: string;
    movement_type: string;
    from_status: string;
    to_status: string;
    from_location: string;
    to_location: string;
    notes: string;
    created_at: string;
    performed_by_email: string;
  }>(
    `SELECT
       im.id,
       im.movement_type,
       COALESCE(im.from_status, '') AS from_status,
       COALESCE(im.to_status, '') AS to_status,
       COALESCE(im.from_location, '') AS from_location,
       COALESCE(im.to_location, '') AS to_location,
       COALESCE(im.notes, '') AS notes,
       im.created_at,
       COALESCE(au.email, '') AS performed_by_email
     FROM inventory_movements im
     LEFT JOIN admin_users au ON au.id = im.performed_by
     WHERE im.device_id = $1
     ORDER BY im.created_at DESC
     LIMIT $2 OFFSET $3`,
    [deviceId, limit, offset]
  );

  if (movements.error) {
    return errorResponse('Failed to fetch movement history', 500, undefined, event);
  }

  return successResponse({
    movements: movements.data,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  }, 200, event);
};
