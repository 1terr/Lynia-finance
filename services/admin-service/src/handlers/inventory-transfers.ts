import { v4 as uuidv4 } from 'uuid';
import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query, withTransaction } from '../../../shared/clients/database';
import { successResponse, errorResponse, parseBody } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger, { getRequestContext } from '../../../shared/utils/logger';
import { auditLog } from './helpers';
import {
  notifyDistributorOfTransferEvent,
} from '../../../shared/utils/notifications';

// ─── GET /admin/inventory/transfers ───

export const handleGetTransfers: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = '1=1';
  const params: unknown[] = [];

  if (qs.status) {
    params.push(qs.status);
    whereClause += ` AND t.status = $${params.length}`;
  }

  if (qs.search) {
    params.push(`%${qs.search}%`);
    whereClause += ` AND (d.imei ILIKE $${params.length} OR d.manufacturer ILIKE $${params.length} OR d.model ILIKE $${params.length} OR fd.business_name ILIKE $${params.length} OR td.business_name ILIKE $${params.length})`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM stock_transfers t LEFT JOIN devices d ON t.device_id = d.id LEFT JOIN distributors fd ON t.from_distributor_id = fd.id LEFT JOIN distributors td ON t.to_distributor_id = td.id WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0');

  params.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT t.*,
            d.imei as device_imei, d.manufacturer, d.model as device_model,
            fd.business_name as from_distributor_name,
            td.business_name as to_distributor_name,
            req.full_name as requested_by_name
     FROM stock_transfers t
     LEFT JOIN devices d ON t.device_id = d.id
     LEFT JOIN distributors fd ON t.from_distributor_id = fd.id
     LEFT JOIN distributors td ON t.to_distributor_id = td.id
     LEFT JOIN admin_users req ON t.requested_by = req.id
     WHERE ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (error) {
    logger.error('Error fetching transfers', {
      action: 'inventory.transfers.list',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to fetch transfers', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};

// ─── POST /admin/inventory/transfers ───

export const handleCreateTransfer: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  if (!body.device_id) {
    return errorResponse('Missing required field: device_id', 400, { code: 'VAL_REQ_001' }, event);
  }

  // Verify device exists and is transferable
  const { data: device } = await db.from('devices')
    .select('id, status')
    .eq('id', body.device_id)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!device) {
    return errorResponse('Device not found', 404, {}, event);
  }

  const deviceRecord = device as Record<string, unknown>;
  if (!['in_stock', 'assigned'].includes(deviceRecord.status as string)) {
    return errorResponse(`Cannot transfer device with status: ${deviceRecord.status}`, 400, {
      code: 'INV_TRANSFER_001',
      requestId: getRequestContext()?.requestId,
      timestamp: new Date().toISOString(),
    }, event);
  }

  const now = new Date().toISOString();
  const autoApprove = body.auto_approve === true;

  const insertData: Record<string, unknown> = {
    device_id: body.device_id,
    from_distributor_id: body.from_distributor_id || null,
    to_distributor_id: body.to_distributor_id || null,
    from_location: body.from_location || null,
    to_location: body.to_location || null,
    status: autoApprove ? 'received' : 'requested',
    requested_by: auth.userId,
    notes: body.notes || null,
    created_at: now,
    updated_at: now,
  };

  if (autoApprove) {
    insertData.approved_by = auth.userId;
    insertData.approved_at = now;
    insertData.shipped_at = now;
    insertData.received_at = now;
  }

  const { data: created, error } = await db.from('stock_transfers').insert(insertData).execute();

  if (error) {
    logger.error('Error creating transfer', {
      action: 'inventory.transfers.create',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to create transfer', 500, {}, event);
  }

  const row = Array.isArray(created) ? created[0] : created;

  // Auto-approve: update device with distributor assignment
  if (autoApprove && body.to_distributor_id) {
    await db.from('devices')
      .update({
        status: 'assigned',
        distributor_id: body.to_distributor_id,
        assigned_to_distributor_at: now,
        location: body.to_location || null,
        updated_at: now,
      })
      .eq('id', body.device_id)
      .execute();
  }

  await auditLog(auth, 'inventory.transfer.create', 'stock_transfer', row.id as string,
    `Created stock transfer for device ${body.device_id}${autoApprove ? ' (auto-approved)' : ''}`, {
    device_id: body.device_id,
    from_distributor_id: body.from_distributor_id,
    to_distributor_id: body.to_distributor_id,
    auto_approve: autoApprove,
  });

  return successResponse(row, 201, event);
};

// ─── PATCH /admin/inventory/transfers/:id ───
// Transfer state machine:
//   requested → approved | cancelled
//   approved → in_transit | cancelled
//   in_transit → pending_receipt | cancelled
//   pending_receipt → received | disputed   (distributor actions)
//   disputed → received | cancelled         (admin force-resolve)
//   return_requested → return_approved | disputed | cancelled
//   return_approved → received | cancelled

export const handleUpdateTransfer: RouteHandler = async (event, params, auth) => {
  const transferId = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const newStatus = body.status;

  const validTransitions: Record<string, string[]> = {
    requested: ['approved', 'cancelled'],
    approved: ['in_transit', 'cancelled'],
    in_transit: ['pending_receipt', 'cancelled'],
    pending_receipt: ['received', 'disputed'],
    disputed: ['received', 'cancelled'],
    return_requested: ['return_approved', 'disputed', 'cancelled'],
    return_approved: ['received', 'cancelled'],
  };

  // Get current transfer
  const { data: transfer } = await db.from('stock_transfers')
    .select('*')
    .eq('id', transferId)
    .maybeSingle()
    .execute();

  if (!transfer) {
    return errorResponse('Transfer not found', 404, {}, event);
  }

  const transferRecord = transfer as Record<string, unknown>;
  const currentStatus = transferRecord.status as string;

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    return errorResponse(
      `Cannot transition from ${currentStatus} to ${newStatus}`,
      400, {
        code: 'INV_TRANSFER_002',
        requestId: getRequestContext()?.requestId,
        timestamp: new Date().toISOString(),
      }, event
    );
  }

  const now = new Date().toISOString();

  // When transitioning to 'received', wrap in a transaction to atomically
  // update the transfer AND the device assignment.
  if (newStatus === 'received') {
    try {
      await withTransaction(async (tx) => {
        await tx(
          `UPDATE stock_transfers
           SET status = 'received',
               received_at = $1,
               updated_at = $1
           WHERE id = $2`,
          [now, transferId]
        );

        const toDistributorId = transferRecord.to_distributor_id as string | null;
        const deviceId = transferRecord.device_id as string;

        if (toDistributorId) {
          await tx(
            `UPDATE devices
             SET distributor_id = $1,
                 assigned_to_distributor_at = $2,
                 status = 'assigned',
                 updated_at = $2
             WHERE id = $3`,
            [toDistributorId, now, deviceId]
          );
        }

        // Record inventory movement
        await tx(
          `INSERT INTO inventory_movements
             (device_id, movement_type, to_distributor_id, reference_type, reference_id, notes, created_at)
           VALUES ($1, 'transfer_received', $2, 'stock_transfer', $3, 'Transfer received', $4)`,
          [deviceId, toDistributorId, transferId, now]
        );
      });

      await auditLog(auth, `inventory.transfer.${newStatus}`, 'stock_transfer', transferId,
        `Updated transfer ${transferId} to ${newStatus}`);

      return successResponse({ message: `Transfer updated to ${newStatus}` }, 200, event);
    } catch (err) {
      logger.error('Error updating transfer to received', {
        action: 'inventory.transfers.update',
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      return errorResponse('Failed to update transfer', 500, {
        requestId: getRequestContext()?.requestId,
        timestamp: new Date().toISOString(),
      }, event);
    }
  }

  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: now,
  };

  if (newStatus === 'approved') {
    updates.approved_by = auth.userId;
    updates.approved_at = now;
  } else if (newStatus === 'in_transit') {
    updates.shipped_at = now;
  } else if (newStatus === 'pending_receipt') {
    // Device assignment now happens when distributor confirms (or admin force-confirms)
    updates.shipped_at = updates.shipped_at || now;
  } else if (newStatus === 'cancelled') {
    updates.cancelled_at = now;
    updates.cancellation_reason = body.cancellation_reason || null;
  }

  const { error } = await db.from('stock_transfers')
    .update(updates)
    .eq('id', transferId)
    .execute();

  if (error) {
    logger.error('Error updating transfer', {
      action: 'inventory.transfers.update',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to update transfer', 500, {
      requestId: getRequestContext()?.requestId,
      timestamp: new Date().toISOString(),
    }, event);
  }

  await auditLog(auth, `inventory.transfer.${newStatus}`, 'stock_transfer', transferId,
    `Updated transfer ${transferId} to ${newStatus}`);

  return successResponse({ message: `Transfer updated to ${newStatus}` }, 200, event);
};

// ─── POST /admin/inventory/transfers/:id/force-confirm ───

export const handleForceConfirm: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const transferId = params.id;

  const { data: body, error: parseError } = parseBody<{ reason: string }>(event);
  if (parseError) return parseError;
  if (!body) return errorResponse('Missing request body', 400, {}, event);

  const { reason } = body;
  if (!reason || reason.trim().length < 5) {
    return errorResponse('Force-confirm reason is required (min 5 characters)', 400, { code: 'VAL_REQ_001' }, event);
  }

  // Get current transfer
  const { data: transfer } = await db.from('stock_transfers')
    .select('*')
    .eq('id', transferId)
    .maybeSingle()
    .execute();

  if (!transfer) {
    return errorResponse('Transfer not found', 404, {}, event);
  }

  const transferRecord = transfer as Record<string, unknown>;
  const currentStatus = transferRecord.status as string;

  if (!['pending_receipt', 'disputed'].includes(currentStatus)) {
    return errorResponse(
      `Cannot force-confirm transfer with status: ${currentStatus}. Must be pending_receipt or disputed.`,
      400, { code: 'VAL_FMT_001' }, event
    );
  }

  try {
    await withTransaction(async (tx) => {
      const now = new Date().toISOString();
      const deviceId = transferRecord.device_id as string;
      const toDistributorId = transferRecord.to_distributor_id as string;

      // Update transfer
      await tx(
        `UPDATE stock_transfers
         SET status = 'received',
             received_at = $1,
             force_confirmed_by = $2,
             force_confirmed_at = $1,
             force_confirm_reason = $3,
             updated_at = $1
         WHERE id = $4`,
        [now, auth.userId, reason.trim(), transferId]
      );

      // Update device assignment
      if (toDistributorId) {
        await tx(
          `UPDATE devices
           SET distributor_id = $1,
               assigned_to_distributor_at = $2,
               status = 'assigned',
               updated_at = $2
           WHERE id = $3`,
          [toDistributorId, now, deviceId]
        );
      }

      // Record inventory movement
      await tx(
        `INSERT INTO inventory_movements
           (device_id, movement_type, to_distributor_id, reference_type, reference_id, notes, created_at)
         VALUES ($1, 'transfer_force_confirmed', $2, 'stock_transfer', $3, $4, $5)`,
        [deviceId, toDistributorId, transferId, `Force confirmed by admin: ${reason.trim()}`, now]
      );

      // Notify distributor
      if (toDistributorId) {
        await notifyDistributorOfTransferEvent(tx, {
          distributorId: toDistributorId,
          type: 'transfer_force_confirmed',
          title: 'Transfer Force-Confirmed',
          message: `An admin has confirmed this transfer on your behalf: ${reason.trim()}`,
          transferId,
        });
      }
    });

    await auditLog(auth, 'inventory.transfer.force_confirm', 'stock_transfer', transferId,
      `Force-confirmed transfer ${transferId}: ${reason.trim()}`);

    return successResponse({ message: 'Transfer force-confirmed successfully' }, 200, event);

  } catch (err) {
    logger.error('Error force-confirming transfer', {
      action: 'inventory.transfers.force_confirm',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to force-confirm transfer', 500, {}, event);
  }
};

// ─── POST /admin/inventory/transfers/return ───

export const handleCreateReturn: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: body, error: parseError } = parseBody<{
    device_id: string;
    from_distributor_id: string;
    reason: string;
  }>(event);
  if (parseError) return parseError;
  if (!body) return errorResponse('Missing request body', 400, {}, event);

  const { device_id, from_distributor_id, reason } = body;
  if (!device_id || !from_distributor_id || !reason) {
    return errorResponse('device_id, from_distributor_id, and reason are required', 400, { code: 'VAL_REQ_001' }, event);
  }

  // Verify device exists and belongs to distributor
  const { data: device } = await db.from('devices')
    .select('id, status, distributor_id')
    .eq('id', device_id)
    .maybeSingle()
    .execute();

  if (!device) {
    return errorResponse('Device not found', 404, {}, event);
  }

  const deviceRecord = device as Record<string, unknown>;
  if (deviceRecord.distributor_id !== from_distributor_id) {
    return errorResponse('Device is not assigned to the specified distributor', 400, { code: 'VAL_FMT_001' }, event);
  }

  if (deviceRecord.status === 'sold') {
    return errorResponse('Cannot return a device that has been sold', 400, { code: 'VAL_FMT_001' }, event);
  }

  try {
    let returnTransferId: string | undefined;

    await withTransaction(async (tx) => {
      const { data: created } = await tx<{ id: string }>(
        `INSERT INTO stock_transfers
           (device_id, from_distributor_id, transfer_type, status,
            initiated_by_type, requested_by, notes, created_at, updated_at)
         VALUES ($1, $2, 'return', 'return_requested', 'admin', $3, $4, NOW(), NOW())
         RETURNING id`,
        [device_id, from_distributor_id, auth.userId, reason.trim()]
      );

      returnTransferId = created[0]?.id;

      // Notify distributor
      if (returnTransferId) {
        await notifyDistributorOfTransferEvent(tx, {
          distributorId: from_distributor_id,
          type: 'return_requested_by_admin',
          title: 'Device Return Requested',
          message: `Admin has requested return of a device: ${reason.trim()}`,
          transferId: returnTransferId,
        });
      }
    });

    await auditLog(auth, 'inventory.transfer.return_create', 'stock_transfer', returnTransferId || null,
      `Created return request for device ${device_id} from distributor ${from_distributor_id}`);

    return successResponse({ message: 'Return request created', transfer_id: returnTransferId }, 201, event);

  } catch (err) {
    logger.error('Error creating return', {
      action: 'inventory.transfers.return_create',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to create return request', 500, {}, event);
  }
};

// ─── POST /admin/inventory/transfers/:id/approve-return ───

export const handleApproveReturn: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const transferId = params.id;

  // Get current transfer
  const { data: transfer } = await db.from('stock_transfers')
    .select('*')
    .eq('id', transferId)
    .maybeSingle()
    .execute();

  if (!transfer) {
    return errorResponse('Transfer not found', 404, {}, event);
  }

  const transferRecord = transfer as Record<string, unknown>;

  if (transferRecord.status !== 'return_requested') {
    return errorResponse(
      `Cannot approve return with status: ${transferRecord.status}. Must be return_requested.`,
      400, { code: 'VAL_FMT_001' }, event
    );
  }

  if (transferRecord.initiated_by_type !== 'distributor') {
    return errorResponse(
      'Only distributor-initiated returns can be approved via this endpoint',
      400, { code: 'VAL_FMT_001' }, event
    );
  }

  const deviceId = transferRecord.device_id as string;
  const fromDistributorId = transferRecord.from_distributor_id as string;

  try {
    await withTransaction(async (tx) => {
      const now = new Date().toISOString();

      // Update transfer to received
      await tx(
        `UPDATE stock_transfers
         SET status = 'received',
             approved_by = $1,
             approved_at = $2,
             received_at = $2,
             updated_at = $2
         WHERE id = $3`,
        [auth.userId, now, transferId]
      );

      // Return device to stock
      await tx(
        `UPDATE devices
         SET status = 'in_stock',
             distributor_id = NULL,
             assigned_to_distributor_at = NULL,
             updated_at = $1
         WHERE id = $2`,
        [now, deviceId]
      );

      // Record inventory movement
      await tx(
        `INSERT INTO inventory_movements
           (device_id, movement_type, from_distributor_id, reference_type, reference_id, notes, created_at)
         VALUES ($1, 'returned', $2, 'stock_transfer', $3, 'Return approved by admin', $4)`,
        [deviceId, fromDistributorId, transferId, now]
      );

      // Notify distributor
      if (fromDistributorId) {
        await notifyDistributorOfTransferEvent(tx, {
          distributorId: fromDistributorId,
          type: 'return_approved',
          title: 'Return Approved',
          message: 'Your device return request has been approved.',
          transferId,
        });
      }
    });

    await auditLog(auth, 'inventory.transfer.return_approved', 'stock_transfer', transferId,
      `Approved return ${transferId}, device ${deviceId} returned to stock`);

    return successResponse({ message: 'Return approved. Device returned to stock.' }, 200, event);

  } catch (err) {
    logger.error('Error approving return', {
      action: 'inventory.transfers.return_approve',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to approve return', 500, {}, event);
  }
};

// ─── POST /admin/inventory/transfers/bulk ───

export const handleBulkTransfer: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const { device_ids, to_distributor_id, auto_approve } = body;

  if (!Array.isArray(device_ids) || device_ids.length === 0) {
    return errorResponse('device_ids must be a non-empty array', 400, { code: 'VAL_REQ_001' }, event);
  }

  if (!to_distributor_id) {
    return errorResponse('Missing required field: to_distributor_id', 400, { code: 'VAL_REQ_001' }, event);
  }

  if (device_ids.length > 500) {
    return errorResponse('Maximum 500 devices per bulk transfer', 400, { code: 'VAL_RNG_001' }, event);
  }

  // Verify distributor exists
  const { data: distributor } = await db.from('distributors')
    .select('id, business_name')
    .eq('id', to_distributor_id)
    .maybeSingle()
    .execute();

  if (!distributor) {
    return errorResponse('Destination distributor not found', 404, {}, event);
  }

  try {
    const result = await withTransaction(async (tx) => {
      const batchId = uuidv4();
      const now = new Date().toISOString();

      // Batch fetch all devices and validate status
      const { data: devices } = await tx<{ id: string; status: string; distributor_id: string | null }>(
        `SELECT id, status, distributor_id FROM devices
         WHERE id = ANY($1) AND deleted_at IS NULL
         FOR UPDATE`,
        [device_ids]
      );

      const deviceMap = new Map(devices.map(d => [d.id, d]));
      const transferableIds: string[] = [];
      const skippedErrors: { device_id: string; error: string }[] = [];

      for (const deviceId of device_ids) {
        const device = deviceMap.get(deviceId);
        if (!device) {
          skippedErrors.push({ device_id: deviceId, error: 'Device not found' });
          continue;
        }
        if (!['in_stock', 'assigned'].includes(device.status)) {
          skippedErrors.push({ device_id: deviceId, error: `Cannot transfer device with status: ${device.status}` });
          continue;
        }
        transferableIds.push(deviceId);
      }

      if (transferableIds.length === 0) {
        return {
          transferred: 0,
          skipped: skippedErrors.length,
          errors: skippedErrors,
          batch_id: batchId,
          spot_check_device_ids: [] as string[],
        };
      }

      // Bulk insert transfers — all land in pending_receipt (not received)
      const transferStatus = auto_approve === true ? 'pending_receipt' : 'requested';
      const transferColumns = [
        'device_id', 'from_distributor_id', 'to_distributor_id',
        'status', 'transfer_type', 'batch_id', 'requested_by',
        'created_at', 'updated_at',
      ];
      const transferValues: unknown[] = [];
      const transferGroups: string[] = [];

      for (const deviceId of transferableIds) {
        const device = deviceMap.get(deviceId)!;
        const offset = transferValues.length;
        transferValues.push(
          deviceId,
          device.distributor_id || null,
          to_distributor_id,
          transferStatus,
          'outbound',
          batchId,
          auth.userId,
          now,
          now,
        );
        const placeholders = transferColumns.map((_, i) => `$${offset + i + 1}`);
        transferGroups.push(`(${placeholders.join(', ')})`);
      }

      const { data: insertedTransfers } = await tx<{ id: string; device_id: string }>(
        `INSERT INTO stock_transfers (${transferColumns.join(', ')})
         VALUES ${transferGroups.join(', ')}
         RETURNING id, device_id`,
        transferValues
      );

      // If auto-approved, also set approved fields
      if (auto_approve === true && insertedTransfers.length > 0) {
        const transferIds = insertedTransfers.map(t => t.id);
        await tx(
          `UPDATE stock_transfers
           SET approved_by = $1, approved_at = $2, shipped_at = $2
           WHERE id = ANY($3)`,
          [auth.userId, now, transferIds]
        );
      }

      // Generate spot-check entries: 10-20% of devices (min 1, max 50)
      const spotCheckCount = Math.min(50, Math.max(1, Math.round(transferableIds.length * 0.15)));
      const shuffled = [...insertedTransfers].sort(() => Math.random() - 0.5);
      const spotCheckTransfers = shuffled.slice(0, spotCheckCount);
      const spotCheckDeviceIds = spotCheckTransfers.map(t => t.device_id);

      if (spotCheckTransfers.length > 0) {
        const scColumns = ['transfer_id', 'device_id', 'imei_verified', 'created_at'];
        const scValues: unknown[] = [];
        const scGroups: string[] = [];

        for (const sc of spotCheckTransfers) {
          const offset = scValues.length;
          scValues.push(sc.id, sc.device_id, false, now);
          const placeholders = scColumns.map((_, i) => `$${offset + i + 1}`);
          scGroups.push(`(${placeholders.join(', ')})`);
        }

        await tx(
          `INSERT INTO transfer_spot_checks (${scColumns.join(', ')})
           VALUES ${scGroups.join(', ')}`,
          scValues
        );
      }

      return {
        transferred: insertedTransfers.length,
        skipped: skippedErrors.length,
        errors: skippedErrors,
        batch_id: batchId,
        spot_check_device_ids: spotCheckDeviceIds,
      };
    });

    await auditLog(auth, 'inventory.transfer.bulk', 'stock_transfer', null,
      `Bulk transfer: ${result.transferred} devices to distributor ${to_distributor_id}`, {
      batch_id: result.batch_id,
      to_distributor_id,
      transferred: result.transferred,
      skipped: result.skipped,
      spot_checks: result.spot_check_device_ids.length,
      auto_approve: auto_approve === true,
    });

    return successResponse(result, 201, event);
  } catch (err) {
    logger.error('Error in bulk transfer', {
      action: 'inventory.transfers.bulk',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to process bulk transfer', 500, {}, event);
  }
};
