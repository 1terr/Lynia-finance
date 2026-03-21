/**
 * Distributor Transfer Handlers
 *
 * Endpoints for distributors to view, confirm, reject incoming transfers,
 * initiate device returns, and manage transfer notifications.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, withTransaction } from '../../../shared/clients/database';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  parseBody,
} from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';
import { resolveDistributor } from '../helpers/resolve-distributor';
import {
  notifyAdminsOfTransferEvent,
} from '../../../shared/utils/notifications';
import logger from '../../../shared/utils/logger';

/**
 * GET /api/v1/distributor/transfers
 *
 * List transfers for this distributor (both incoming and outgoing).
 * Supports filtering by status and type, with pagination.
 */
export const handleGetTransfers: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const dist = await resolveDistributor(auth, event);
  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  const params: unknown[] = [dist.id];
  let whereClause = '(t.to_distributor_id = $1 OR t.from_distributor_id = $1)';

  if (qs.status) {
    params.push(qs.status);
    whereClause += ` AND t.status = $${params.length}`;
  }

  if (qs.type) {
    params.push(qs.type);
    whereClause += ` AND t.transfer_type = $${params.length}`;
  }

  // Count query
  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM stock_transfers t
     WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0');

  // Pending count (transfers needing this distributor's action)
  const { data: pendingRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM stock_transfers t
     WHERE t.to_distributor_id = $1 AND t.status = 'pending_receipt'`,
    [dist.id]
  );
  const pendingCount = parseInt(pendingRows[0]?.count || '0');

  // Data query
  params.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT
       t.id,
       t.device_id,
       t.transfer_type,
       t.status,
       t.batch_id,
       t.notes,
       t.created_at,
       t.confirmed_at,
       t.rejected_at,
       t.rejection_reason,
       t.received_at,
       d.manufacturer AS device_brand,
       d.model AS device_model,
       CONCAT(LEFT(d.imei, 4), '****', RIGHT(d.imei, 4)) AS device_imei_masked,
       fd.business_name AS from_distributor_name,
       td.business_name AS to_distributor_name
     FROM stock_transfers t
     LEFT JOIN devices d ON t.device_id = d.id
     LEFT JOIN distributors fd ON t.from_distributor_id = fd.id
     LEFT JOIN distributors td ON t.to_distributor_id = td.id
     WHERE ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (error) {
    logger.error('Error fetching distributor transfers', {
      action: 'distributor.transfers.list',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to fetch transfers', 500, undefined, event);
  }

  return successResponse({
    data: rows,
    pending_count: pendingCount,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  }, 200, event);
};

/**
 * GET /api/v1/distributor/transfers/pending-count
 *
 * Returns count of transfers needing distributor action.
 */
export const handleGetPendingCount: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const dist = await resolveDistributor(auth, event);
  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const { data: rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM stock_transfers
     WHERE to_distributor_id = $1 AND status = 'pending_receipt'`,
    [dist.id]
  );

  return successResponse({
    pending_count: parseInt(rows[0]?.count || '0'),
  }, 200, event);
};

/**
 * GET /api/v1/distributor/transfers/:id
 *
 * Get a single transfer with full details including spot-check items.
 */
export const handleGetTransferById: RouteHandler = async (event, params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const dist = await resolveDistributor(auth, event);
  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const transferId = params.id;

  const { data: transfers } = await query(
    `SELECT
       t.*,
       d.manufacturer AS device_brand,
       d.model AS device_model,
       CONCAT(LEFT(d.imei, 4), '****', RIGHT(d.imei, 4)) AS device_imei_masked,
       d.retail_price_usd,
       d.storage_gb,
       d.color,
       d.condition,
       fd.business_name AS from_distributor_name,
       td.business_name AS to_distributor_name
     FROM stock_transfers t
     LEFT JOIN devices d ON t.device_id = d.id
     LEFT JOIN distributors fd ON t.from_distributor_id = fd.id
     LEFT JOIN distributors td ON t.to_distributor_id = td.id
     WHERE t.id = $1
       AND (t.to_distributor_id = $2 OR t.from_distributor_id = $2)`,
    [transferId, dist.id]
  );

  if (transfers.length === 0) {
    return notFoundResponse('Transfer', event);
  }

  const transfer = transfers[0];

  // Fetch spot-check items if they exist
  const { data: spotChecks } = await query(
    `SELECT
       sc.id,
       sc.device_id,
       sc.imei_verified,
       sc.condition_rating,
       sc.verified_at,
       d.manufacturer AS device_brand,
       d.model AS device_model,
       CONCAT(LEFT(d.imei, 4), '****', RIGHT(d.imei, 4)) AS device_imei_masked
     FROM transfer_spot_checks sc
     JOIN devices d ON sc.device_id = d.id
     WHERE sc.transfer_id = $1
     ORDER BY sc.created_at`,
    [transferId]
  );

  return successResponse({
    ...transfer,
    spot_checks: spotChecks,
  }, 200, event);
};

/**
 * POST /api/v1/distributor/transfers/:id/confirm
 *
 * Confirm receipt of a transfer. Updates device assignment.
 * For batch transfers, confirms all transfers with same batch_id.
 */
export const handleConfirmTransfer: RouteHandler = async (event, params, auth) => {
  requireRole(auth, 'distributor');

  const dist = await resolveDistributor(auth, event);
  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const transferId = params.id;

  const { data: body, error: parseError } = parseBody<{
    spot_checks?: { device_id: string; imei_verified: boolean; condition_rating: string }[];
  }>(event);
  if (parseError) return parseError;

  // Verify transfer exists and belongs to this distributor
  const { data: transfers } = await query<{
    id: string;
    to_distributor_id: string;
    status: string;
    device_id: string;
    batch_id: string | null;
  }>(
    `SELECT id, to_distributor_id, status, device_id, batch_id
     FROM stock_transfers
     WHERE id = $1`,
    [transferId]
  );

  if (transfers.length === 0) {
    return notFoundResponse('Transfer', event);
  }

  const transfer = transfers[0];

  if (transfer.to_distributor_id !== dist.id) {
    return errorResponse('You can only confirm transfers assigned to you', 403, undefined, event);
  }

  if (transfer.status !== 'pending_receipt') {
    return errorResponse(
      `Cannot confirm transfer with status: ${transfer.status}`,
      400,
      { current_status: transfer.status },
      event
    );
  }

  // Check if spot-checks are required for this transfer
  const { data: requiredChecks } = await query<{ id: string; device_id: string }>(
    `SELECT id, device_id FROM transfer_spot_checks WHERE transfer_id = $1`,
    [transferId]
  );

  if (requiredChecks.length > 0) {
    if (!body?.spot_checks || body.spot_checks.length !== requiredChecks.length) {
      return errorResponse(
        `All ${requiredChecks.length} spot-check items must be completed`,
        400,
        { required: requiredChecks.length, provided: body?.spot_checks?.length || 0 },
        event
      );
    }
  }

  // Determine all transfers to confirm (batch support)
  let transferIdsToConfirm: string[] = [transferId];
  if (transfer.batch_id) {
    const { data: batchTransfers } = await query<{ id: string; device_id: string }>(
      `SELECT id, device_id FROM stock_transfers
       WHERE batch_id = $1 AND to_distributor_id = $2 AND status = 'pending_receipt'`,
      [transfer.batch_id, dist.id]
    );
    transferIdsToConfirm = batchTransfers.map(t => t.id);
  }

  try {
    await withTransaction(async (tx) => {
      const now = new Date().toISOString();

      for (const tId of transferIdsToConfirm) {
        // Get the device_id for this transfer
        const { data: tRows } = await tx<{ device_id: string }>(
          `SELECT device_id FROM stock_transfers WHERE id = $1`,
          [tId]
        );
        const deviceId = tRows[0]?.device_id;
        if (!deviceId) continue;

        // Update transfer status
        await tx(
          `UPDATE stock_transfers
           SET status = 'received',
               confirmed_by = $1,
               confirmed_at = $2,
               received_at = $2,
               updated_at = $2
           WHERE id = $3`,
          [dist.id, now, tId]
        );

        // Update device assignment
        await tx(
          `UPDATE devices
           SET distributor_id = $1,
               assigned_to_distributor_at = $2,
               status = 'assigned',
               updated_at = $2
           WHERE id = $3`,
          [dist.id, now, deviceId]
        );

        // Record inventory movement
        await tx(
          `INSERT INTO inventory_movements
             (device_id, movement_type, to_distributor_id, reference_type, reference_id, notes, created_at)
           VALUES ($1, 'transfer_received', $2, 'stock_transfer', $3, 'Confirmed by distributor', $4)`,
          [deviceId, dist.id, tId, now]
        );
      }

      // Update spot-checks if provided
      if (body?.spot_checks && body.spot_checks.length > 0) {
        for (const sc of body.spot_checks) {
          await tx(
            `UPDATE transfer_spot_checks
             SET imei_verified = $1,
                 condition_rating = $2,
                 verified_at = $3,
                 verified_by = $4
             WHERE transfer_id = $5 AND device_id = $6`,
            [sc.imei_verified, sc.condition_rating, now, dist.id, transferId, sc.device_id]
          );
        }
      }

      // Notify admins
      await notifyAdminsOfTransferEvent(tx, {
        type: 'transfer_confirmed',
        title: 'Transfer Confirmed',
        message: `Distributor confirmed receipt of ${transferIdsToConfirm.length} device(s)`,
        transferId,
      });
    });

    logger.info('Transfer confirmed by distributor', {
      action: 'distributor.transfer.confirm',
      status: 'completed',
      transferId,
      distributorId: dist.id,
      batchSize: transferIdsToConfirm.length,
    });

    return successResponse({
      message: `Successfully confirmed ${transferIdsToConfirm.length} transfer(s)`,
      confirmed_transfer_ids: transferIdsToConfirm,
    }, 200, event);

  } catch (error) {
    logger.error('Failed to confirm transfer', {
      action: 'distributor.transfer.confirm',
      status: 'failed',
      transferId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('Failed to confirm transfer', 500, undefined, event);
  }
};

/**
 * POST /api/v1/distributor/transfers/:id/reject
 *
 * Reject/dispute an incoming transfer.
 */
export const handleRejectTransfer: RouteHandler = async (event, params, auth) => {
  requireRole(auth, 'distributor');

  const dist = await resolveDistributor(auth, event);
  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const transferId = params.id;

  const { data: body, error: parseError } = parseBody<{ reason: string }>(event);
  if (parseError) return parseError;
  if (!body) return errorResponse('Missing request body', 400, undefined, event);

  const { reason } = body;
  if (!reason || reason.trim().length < 10) {
    return errorResponse('Rejection reason must be at least 10 characters', 400, undefined, event);
  }

  // Verify transfer exists and belongs to this distributor
  const { data: transfers } = await query<{
    id: string;
    to_distributor_id: string;
    status: string;
  }>(
    `SELECT id, to_distributor_id, status FROM stock_transfers WHERE id = $1`,
    [transferId]
  );

  if (transfers.length === 0) {
    return notFoundResponse('Transfer', event);
  }

  const transfer = transfers[0];

  if (transfer.to_distributor_id !== dist.id) {
    return errorResponse('You can only reject transfers assigned to you', 403, undefined, event);
  }

  if (transfer.status !== 'pending_receipt') {
    return errorResponse(
      `Cannot reject transfer with status: ${transfer.status}`,
      400,
      { current_status: transfer.status },
      event
    );
  }

  try {
    await withTransaction(async (tx) => {
      await tx(
        `UPDATE stock_transfers
         SET status = 'disputed',
             rejected_at = NOW(),
             rejection_reason = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [reason.trim(), transferId]
      );

      // Notify admins
      await notifyAdminsOfTransferEvent(tx, {
        type: 'transfer_disputed',
        title: 'Transfer Disputed',
        message: `Distributor rejected transfer: ${reason.trim()}`,
        transferId,
      });
    });

    logger.info('Transfer rejected by distributor', {
      action: 'distributor.transfer.reject',
      status: 'completed',
      transferId,
      distributorId: dist.id,
    });

    return successResponse({
      message: 'Transfer has been disputed. Admin will review.',
    }, 200, event);

  } catch (error) {
    logger.error('Failed to reject transfer', {
      action: 'distributor.transfer.reject',
      status: 'failed',
      transferId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('Failed to reject transfer', 500, undefined, event);
  }
};

/**
 * POST /api/v1/distributor/transfers/return
 *
 * Initiate a device return request.
 */
export const handleInitiateReturn: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor');

  const dist = await resolveDistributor(auth, event);
  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const { data: body, error: parseError } = parseBody<{
    device_id: string;
    reason: string;
  }>(event);
  if (parseError) return parseError;
  if (!body) return errorResponse('Missing request body', 400, undefined, event);

  const { device_id, reason } = body;
  if (!device_id || !reason) {
    return errorResponse('device_id and reason are required', 400, undefined, event);
  }

  if (reason.trim().length < 10) {
    return errorResponse('Return reason must be at least 10 characters', 400, undefined, event);
  }

  // Verify device belongs to this distributor and is not sold
  const { data: devices } = await query<{
    id: string;
    distributor_id: string;
    status: string;
    manufacturer: string;
    model: string;
  }>(
    `SELECT id, distributor_id, status, manufacturer, model
     FROM devices
     WHERE id = $1`,
    [device_id]
  );

  if (devices.length === 0) {
    return notFoundResponse('Device', event);
  }

  const device = devices[0];

  if (device.distributor_id !== dist.id) {
    return errorResponse('Device is not in your inventory', 403, undefined, event);
  }

  if (device.status === 'sold') {
    return errorResponse('Cannot return a device that has been sold', 400, undefined, event);
  }

  // Check for existing pending return
  const { data: existingReturns } = await query<{ id: string }>(
    `SELECT id FROM stock_transfers
     WHERE device_id = $1 AND transfer_type = 'return'
       AND status IN ('return_requested', 'return_approved')
     LIMIT 1`,
    [device_id]
  );

  if (existingReturns.length > 0) {
    return errorResponse(
      'A return request already exists for this device',
      409,
      { existing_return_id: existingReturns[0].id },
      event
    );
  }

  try {
    let returnTransferId: string | undefined;

    await withTransaction(async (tx) => {
      const { data: created } = await tx<{ id: string }>(
        `INSERT INTO stock_transfers
           (device_id, from_distributor_id, transfer_type, status,
            initiated_by_type, initiated_by_distributor, notes, created_at, updated_at)
         VALUES ($1, $2, 'return', 'return_requested', 'distributor', $2, $3, NOW(), NOW())
         RETURNING id`,
        [device_id, dist.id, reason.trim()]
      );

      returnTransferId = created[0]?.id;

      // Notify admins
      if (returnTransferId) {
        await notifyAdminsOfTransferEvent(tx, {
          type: 'return_requested',
          title: 'Device Return Requested',
          message: `Distributor requested return of ${device.manufacturer} ${device.model}: ${reason.trim()}`,
          transferId: returnTransferId,
        });
      }
    });

    logger.info('Return initiated by distributor', {
      action: 'distributor.transfer.return',
      status: 'completed',
      deviceId: device_id,
      distributorId: dist.id,
      transferId: returnTransferId,
    });

    return successResponse({
      message: 'Return request submitted. Admin will review.',
      transfer_id: returnTransferId,
    }, 201, event);

  } catch (error) {
    logger.error('Failed to initiate return', {
      action: 'distributor.transfer.return',
      status: 'failed',
      deviceId: device_id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('Failed to initiate return', 500, undefined, event);
  }
};

/**
 * PATCH /api/v1/distributor/notifications/:id/read
 *
 * Mark a notification as read.
 */
export const handleMarkNotificationRead: RouteHandler = async (event, params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const dist = await resolveDistributor(auth, event);
  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const notificationId = params.id;

  const { data: updated } = await query(
    `UPDATE notifications
     SET read = TRUE, read_at = NOW()
     WHERE id = $1
       AND recipient_type = 'distributor'
       AND recipient_id = $2
     RETURNING id`,
    [notificationId, dist.id]
  );

  if (updated.length === 0) {
    return notFoundResponse('Notification', event);
  }

  return successResponse({ message: 'Notification marked as read' }, 200, event);
};
