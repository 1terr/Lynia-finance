import { v4 as uuidv4 } from 'uuid';
import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, withTransaction } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';

// ─── POST /admin/inventory/allocate ───
// Shortcut for warehouse → distributor allocation.
// Creates transfers and assigns devices in a single transaction.

export const handleBulkAllocate: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const { device_ids, distributor_id } = body;

  if (!Array.isArray(device_ids) || device_ids.length === 0) {
    return errorResponse('device_ids must be a non-empty array', 400, { code: 'VAL_REQ_001' }, event);
  }

  if (!distributor_id) {
    return errorResponse('Missing required field: distributor_id', 400, { code: 'VAL_REQ_001' }, event);
  }

  if (device_ids.length > 500) {
    return errorResponse('Maximum 500 devices per allocation', 400, { code: 'VAL_RNG_001' }, event);
  }

  // Verify distributor exists
  const { data: distributor } = await db.from('distributors')
    .select('id, business_name')
    .eq('id', distributor_id)
    .maybeSingle()
    .execute();

  if (!distributor) {
    return errorResponse('Distributor not found', 404, {}, event);
  }

  try {
    const result = await withTransaction(async (tx) => {
      const batchId = uuidv4();
      const now = new Date().toISOString();

      // Batch fetch all devices — only in_stock devices can be allocated from warehouse
      const { data: devices } = await tx<{ id: string; status: string; distributor_id: string | null }>(
        `SELECT id, status, distributor_id FROM devices
         WHERE id = ANY($1) AND deleted_at IS NULL
         FOR UPDATE`,
        [device_ids]
      );

      const deviceMap = new Map(devices.map(d => [d.id, d]));
      const allocatableIds: string[] = [];
      const errors: { device_id: string; error: string }[] = [];

      for (const deviceId of device_ids) {
        const device = deviceMap.get(deviceId);
        if (!device) {
          errors.push({ device_id: deviceId, error: 'Device not found' });
          continue;
        }
        if (device.status !== 'in_stock') {
          errors.push({ device_id: deviceId, error: `Device status is ${device.status}, must be in_stock for allocation` });
          continue;
        }
        if (device.distributor_id) {
          errors.push({ device_id: deviceId, error: 'Device is already assigned to a distributor' });
          continue;
        }
        allocatableIds.push(deviceId);
      }

      if (allocatableIds.length === 0) {
        return { allocated: 0, skipped: errors.length, errors, batch_id: batchId };
      }

      // Create transfers (auto-approved, received immediately)
      const transferColumns = [
        'device_id', 'to_distributor_id', 'status', 'transfer_type',
        'batch_id', 'requested_by', 'approved_by', 'approved_at',
        'shipped_at', 'received_at', 'created_at', 'updated_at',
      ];
      const transferValues: unknown[] = [];
      const transferGroups: string[] = [];

      for (const deviceId of allocatableIds) {
        const offset = transferValues.length;
        transferValues.push(
          deviceId,
          distributor_id,
          'received',
          'outbound',
          batchId,
          auth.userId,
          auth.userId,
          now,
          now,
          now,
          now,
          now,
        );
        const placeholders = transferColumns.map((_, i) => `$${offset + i + 1}`);
        transferGroups.push(`(${placeholders.join(', ')})`);
      }

      await tx(
        `INSERT INTO stock_transfers (${transferColumns.join(', ')})
         VALUES ${transferGroups.join(', ')}`,
        transferValues
      );

      // Bulk update devices — assign to distributor
      await tx(
        `UPDATE devices
         SET status = 'assigned',
             distributor_id = $1,
             assigned_to_distributor_at = $2,
             updated_at = $2
         WHERE id = ANY($3)`,
        [distributor_id, now, allocatableIds]
      );

      return {
        allocated: allocatableIds.length,
        skipped: errors.length,
        errors,
        batch_id: batchId,
      };
    });

    await auditLog(auth, 'inventory.allocate.bulk', 'stock_transfer', null,
      `Bulk allocation: ${result.allocated} devices to distributor ${distributor_id}`, {
      batch_id: result.batch_id,
      distributor_id,
      allocated: result.allocated,
      skipped: result.skipped,
    });

    return successResponse(result, 201, event);
  } catch (err) {
    logger.error('Error in bulk allocation', {
      action: 'inventory.allocate.bulk',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to process bulk allocation', 500, {}, event);
  }
};
