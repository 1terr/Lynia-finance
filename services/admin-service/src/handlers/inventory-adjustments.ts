import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query, withTransaction } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger, { getRequestContext } from '../../../shared/utils/logger';
import { auditLog, COGNITO_ADMIN_ROLES } from './helpers';

// ─── GET /admin/inventory/adjustments ───

export const handleGetAdjustments: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = '1=1';
  const params: unknown[] = [];

  if (qs.approval_status) {
    params.push(qs.approval_status);
    whereClause += ` AND a.approval_status = $${params.length}`;
  }

  if (qs.adjustment_type) {
    params.push(qs.adjustment_type);
    whereClause += ` AND a.adjustment_type = $${params.length}`;
  }

  if (qs.search) {
    params.push(`%${qs.search}%`);
    whereClause += ` AND (d.imei ILIKE $${params.length} OR d.manufacturer ILIKE $${params.length} OR d.model ILIKE $${params.length} OR a.reason ILIKE $${params.length})`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM inventory_adjustments a LEFT JOIN devices d ON a.device_id = d.id WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0');

  params.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT a.*,
            d.imei as device_imei, d.manufacturer, d.model as device_model,
            req.full_name as requested_by_name, req.email as requested_by_email,
            appr.full_name as approved_by_name
     FROM inventory_adjustments a
     LEFT JOIN devices d ON a.device_id = d.id
     LEFT JOIN admin_users req ON a.requested_by = req.id
     LEFT JOIN admin_users appr ON a.approved_by = appr.id
     WHERE ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (error) {
    logger.error('Error fetching adjustments', {
      action: 'inventory.adjustments.list',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to fetch adjustments', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};

// ─── POST /admin/inventory/adjustments ───

export const handleCreateAdjustment: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  if (!body.device_id) {
    return errorResponse('Missing required field: device_id', 400, { code: 'VAL_REQ_001' }, event);
  }
  if (!body.adjustment_type) {
    return errorResponse('Missing required field: adjustment_type', 400, { code: 'VAL_REQ_001' }, event);
  }
  if (!body.reason) {
    return errorResponse('Missing required field: reason', 400, { code: 'VAL_REQ_001' }, event);
  }

  const validTypes = ['add', 'remove', 'damage', 'write_off', 'found', 'audit_correction'];
  if (!validTypes.includes(body.adjustment_type)) {
    return errorResponse(`Invalid adjustment_type. Must be one of: ${validTypes.join(', ')}`, 400, {
      code: 'INV_ADJ_001',
      requestId: getRequestContext()?.requestId,
      timestamp: new Date().toISOString(),
    }, event);
  }

  // Get current device status
  const { data: device, error: deviceError } = await db.from('devices')
    .select('id, status')
    .eq('id', body.device_id)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (deviceError) {
    logger.error('Error looking up device', {
      action: 'inventory.adjustments.create',
      status: 'failed',
      errorMessage: deviceError.message,
    });
    return errorResponse('Failed to look up device', 500, {}, event);
  }

  if (!device) {
    return errorResponse('Device not found', 404, {}, event);
  }

  const insertData: Record<string, unknown> = {
    device_id: body.device_id,
    device_model_id: body.device_model_id || null,
    adjustment_type: body.adjustment_type,
    reason: body.reason,
    previous_status: (device as Record<string, unknown>).status,
    new_status: body.new_status || null,
    requested_by: auth.userId,
    approval_status: 'pending',
    notes: body.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await db.from('inventory_adjustments').insert(insertData).execute();

  if (error) {
    logger.error('Error creating adjustment', {
      action: 'inventory.adjustments.create',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to create adjustment', 500, {}, event);
  }

  const row = Array.isArray(created) ? created[0] : created;

  await auditLog(auth, 'inventory.adjustment.create', 'inventory_adjustment', row.id as string,
    `Created inventory adjustment: ${body.adjustment_type} for device ${body.device_id}`, {
    adjustment_type: body.adjustment_type, device_id: body.device_id,
  });

  return successResponse(row, 201, event);
};

// ─── POST /admin/inventory/adjustments/:id/approve ───

export const handleApproveAdjustment: RouteHandler = async (event, params, auth) => {
  const adjustmentId = params.id;

  if (!auth.roles.some(r => COGNITO_ADMIN_ROLES.includes(r))) {
    return errorResponse('Only administrators can approve adjustments', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const action = body.action; // 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return errorResponse('action must be approve or reject', 400, { code: 'VAL_FMT_001' }, event);
  }

  // Get adjustment
  const { data: adj, error: adjError } = await db.from('inventory_adjustments')
    .select('*')
    .eq('id', adjustmentId)
    .eq('approval_status', 'pending')
    .maybeSingle()
    .execute();

  if (adjError) {
    logger.error('Error fetching adjustment', {
      action: 'inventory.adjustments.approve',
      status: 'failed',
      errorMessage: adjError.message,
    });
    return errorResponse('Failed to fetch adjustment', 500, {}, event);
  }

  if (!adj) {
    return errorResponse('Pending adjustment not found', 404, {}, event);
  }

  const adjRecord = adj as Record<string, unknown>;

  if (action === 'approve') {
    // Apply the adjustment to the device
    if (adjRecord.new_status) {
      const { error: deviceErr } = await db.from('devices')
        .update({
          status: adjRecord.new_status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', adjRecord.device_id as string)
        .execute();
      if (deviceErr) {
        logger.error('Failed to update device status', {
          action: 'inventory.adjustment.approve', status: 'failed',
          errorMessage: deviceErr.message,
        });
        return errorResponse('Failed to update device status', 500, {}, event);
      }
    }

    const { error: approveErr } = await db.from('inventory_adjustments')
      .update({
        approval_status: 'approved',
        approved_by: auth.userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', adjustmentId)
      .execute();
    if (approveErr) {
      logger.error('Failed to approve adjustment', {
        action: 'inventory.adjustment.approve', status: 'failed',
        errorMessage: approveErr.message,
      });
      return errorResponse('Failed to approve adjustment', 500, {}, event);
    }
  } else {
    const { error: rejectErr } = await db.from('inventory_adjustments')
      .update({
        approval_status: 'rejected',
        approved_by: auth.userId,
        approved_at: new Date().toISOString(),
        rejection_reason: body.rejection_reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adjustmentId)
      .execute();
    if (rejectErr) {
      logger.error('Failed to reject adjustment', {
        action: 'inventory.adjustment.reject', status: 'failed',
        errorMessage: rejectErr.message,
      });
      return errorResponse('Failed to reject adjustment', 500, {}, event);
    }
  }

  await auditLog(auth, `inventory.adjustment.${action}`, 'inventory_adjustment', adjustmentId,
    `${action === 'approve' ? 'Approved' : 'Rejected'} adjustment ${adjustmentId}`);

  return successResponse({ message: `Adjustment ${action}d successfully` }, 200, event);
};

// ─── POST /admin/inventory/adjustments/bulk ───

export const handleBulkAdjustment: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const { device_ids, adjustment_type, reason } = body;

  if (!Array.isArray(device_ids) || device_ids.length === 0) {
    return errorResponse('device_ids must be a non-empty array', 400, { code: 'VAL_REQ_001' }, event);
  }

  if (!adjustment_type) {
    return errorResponse('Missing required field: adjustment_type', 400, { code: 'VAL_REQ_001' }, event);
  }

  if (!reason) {
    return errorResponse('Missing required field: reason', 400, { code: 'VAL_REQ_001' }, event);
  }

  const validTypes = ['add', 'remove', 'damage', 'write_off', 'found', 'audit_correction'];
  if (!validTypes.includes(adjustment_type)) {
    return errorResponse(`Invalid adjustment_type. Must be one of: ${validTypes.join(', ')}`, 400, { code: 'VAL_FMT_001' }, event);
  }

  if (device_ids.length > 500) {
    return errorResponse('Maximum 500 devices per bulk adjustment', 400, { code: 'VAL_RNG_001' }, event);
  }

  try {
    const result = await withTransaction(async (tx) => {
      const now = new Date().toISOString();

      // Batch fetch all devices
      const { data: devices } = await tx<{ id: string; status: string }>(
        `SELECT id, status FROM devices WHERE id = ANY($1) AND deleted_at IS NULL`,
        [device_ids]
      );

      const deviceMap = new Map(devices.map(d => [d.id, d]));
      const errors: { device_id: string; error: string }[] = [];
      const validEntries: { device_id: string; previous_status: string }[] = [];

      for (const deviceId of device_ids) {
        const device = deviceMap.get(deviceId);
        if (!device) {
          errors.push({ device_id: deviceId, error: 'Device not found' });
          continue;
        }
        validEntries.push({ device_id: deviceId, previous_status: device.status });
      }

      if (validEntries.length === 0) {
        return { created: 0, adjustment_ids: [] as string[], errors };
      }

      // Bulk insert adjustments
      const columns = [
        'device_id', 'adjustment_type', 'reason', 'previous_status',
        'new_status', 'requested_by', 'approval_status', 'notes',
        'created_at', 'updated_at',
      ];
      const values: unknown[] = [];
      const groups: string[] = [];

      for (const entry of validEntries) {
        const offset = values.length;
        values.push(
          entry.device_id,
          adjustment_type,
          reason,
          entry.previous_status,
          body.new_status || null,
          auth.userId,
          'pending',
          body.notes || null,
          now,
          now,
        );
        const placeholders = columns.map((_, i) => `$${offset + i + 1}`);
        groups.push(`(${placeholders.join(', ')})`);
      }

      const { data: insertedRows } = await tx<{ id: string }>(
        `INSERT INTO inventory_adjustments (${columns.join(', ')})
         VALUES ${groups.join(', ')}
         RETURNING id`,
        values
      );

      return {
        created: insertedRows.length,
        adjustment_ids: insertedRows.map(r => r.id),
        errors,
      };
    });

    await auditLog(auth, 'inventory.adjustment.bulk', 'inventory_adjustment', null,
      `Bulk adjustment: ${result.created} ${adjustment_type} adjustments created`, {
      adjustment_type,
      reason,
      created: result.created,
      errors_count: result.errors.length,
    });

    return successResponse(result, 201, event);
  } catch (err) {
    logger.error('Error in bulk adjustment', {
      action: 'inventory.adjustments.bulk',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to process bulk adjustment', 500, {}, event);
  }
};
