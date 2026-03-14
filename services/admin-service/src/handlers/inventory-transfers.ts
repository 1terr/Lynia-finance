import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';

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
    return errorResponse(`Cannot transfer device with status: ${deviceRecord.status}`, 400, { code: 'VAL_FMT_001' }, event);
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

  // Auto-approve: update device and create agent_inventory record
  if (autoApprove && body.to_distributor_id) {
    await db.from('devices')
      .update({
        status: 'assigned',
        location: body.to_location || null,
        updated_at: now,
      })
      .eq('id', body.device_id)
      .execute();

    await db.from('agent_inventory').insert({
      distributor_id: body.to_distributor_id,
      device_id: body.device_id,
      assigned_date: now.split('T')[0],
      status: 'available',
      created_at: now,
      updated_at: now,
    }).execute();
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
// Transfer state machine: requested → approved → in_transit → received

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
    in_transit: ['received', 'cancelled'],
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
      400, { code: 'VAL_FMT_001' }, event
    );
  }

  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === 'approved') {
    updates.approved_by = auth.userId;
    updates.approved_at = new Date().toISOString();
  } else if (newStatus === 'in_transit') {
    updates.shipped_at = new Date().toISOString();
  } else if (newStatus === 'received') {
    updates.received_at = new Date().toISOString();

    // Update device location and agent_inventory
    if (transferRecord.to_distributor_id) {
      await db.from('devices')
        .update({
          status: 'assigned',
          location: transferRecord.to_location || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transferRecord.device_id as string)
        .execute();

      // Create agent_inventory record
      await db.from('agent_inventory').insert({
        distributor_id: transferRecord.to_distributor_id,
        device_id: transferRecord.device_id,
        assigned_date: new Date().toISOString().split('T')[0],
        status: 'available',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).execute();
    }
  } else if (newStatus === 'cancelled') {
    updates.cancelled_at = new Date().toISOString();
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
    return errorResponse('Failed to update transfer', 500, {}, event);
  }

  await auditLog(auth, `inventory.transfer.${newStatus}`, 'stock_transfer', transferId,
    `Updated transfer ${transferId} to ${newStatus}`);

  return successResponse({ message: `Transfer updated to ${newStatus}` }, 200, event);
};
