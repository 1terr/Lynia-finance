import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';

// ─── Inventory Constants ───

const IMEI_REGEX = /^\d{15}$/;

const VALID_DEVICE_STATUSES = [
  'in_stock', 'assigned', 'reserved', 'sold', 'returned',
  'repossessed', 'damaged', 'lost', 'written_off',
] as const;

// ─── GET /admin/devices ───

export const handleGetDevices: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = 'deleted_at IS NULL';
  const params: unknown[] = [];

  if (qs.status) {
    params.push(qs.status);
    whereClause += ` AND status = $${params.length}`;
  }

  if (qs.lock_status) {
    params.push(qs.lock_status);
    whereClause += ` AND lock_status = $${params.length}`;
  }

  if (qs.device_model_id) {
    params.push(qs.device_model_id);
    whereClause += ` AND device_model_id = $${params.length}`;
  }

  if (qs.search) {
    params.push(`%${qs.search}%`);
    const idx = params.length;
    whereClause += ` AND (imei ILIKE $${idx} OR manufacturer ILIKE $${idx} OR model ILIKE $${idx} OR serial_number ILIKE $${idx})`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM devices WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0');

  params.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT d.*, c.full_name as customer_name, c.phone_number as customer_phone
     FROM devices d
     LEFT JOIN customers c ON d.customer_id = c.id
     WHERE d.${whereClause}
     ORDER BY d.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (error) {
    logger.error('Error fetching devices', { action: 'admin.devices.list', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to fetch devices', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};

// ─── POST /admin/devices ───

export const handleCreateDevice: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  // Validate required fields
  if (!body.imei) {
    return errorResponse('Missing required field: imei', 400, { code: 'VAL_REQ_001' }, event);
  }
  if (!IMEI_REGEX.test(body.imei)) {
    return errorResponse('IMEI must be exactly 15 digits', 400, { code: 'VAL_FMT_001' }, event);
  }
  if (!body.manufacturer) {
    return errorResponse('Missing required field: manufacturer', 400, { code: 'VAL_REQ_001' }, event);
  }
  if (!body.model) {
    return errorResponse('Missing required field: model', 400, { code: 'VAL_REQ_001' }, event);
  }

  // Check IMEI uniqueness
  const { data: existing } = await db.from('devices')
    .select('id')
    .eq('imei', body.imei)
    .maybeSingle()
    .execute();

  if (existing) {
    return errorResponse('A device with this IMEI already exists', 409, {}, event);
  }

  const insertData: Record<string, unknown> = {
    imei: body.imei,
    serial_number: body.serial_number || null,
    manufacturer: body.manufacturer,
    model: body.model,
    device_type: body.device_type || 'smartphone',
    storage_gb: body.storage_gb || null,
    color: body.color || null,
    condition: body.condition || 'new',
    purchase_price_usd: body.purchase_price_usd || null,
    retail_price_usd: body.retail_price_usd || null,
    device_model_id: body.device_model_id || null,
    status: 'in_stock',
    location: body.location || 'Warehouse',
    lock_status: 'unlocked',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await db.from('devices').insert(insertData).execute();

  if (error) {
    logger.error('Error creating device', { action: 'admin.devices.create', status: 'failed', errorMessage: error.message });
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      return errorResponse('A device with this IMEI already exists', 409, {}, event);
    }
    return errorResponse('Failed to create device', 500, {}, event);
  }

  const row = Array.isArray(created) ? created[0] : created;

  await auditLog(auth, 'device.create', 'device', row.id as string,
    `Registered device: ${body.manufacturer} ${body.model} (IMEI: ${body.imei})`, {
    imei: body.imei, manufacturer: body.manufacturer, model: body.model,
  });

  return successResponse(row, 201, event);
};

// ─── POST /admin/devices/bulk-import ───

export const handleBulkImportDevices: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const devices = body.devices;

  if (!Array.isArray(devices) || devices.length === 0) {
    return errorResponse('devices must be a non-empty array', 400, { code: 'VAL_REQ_001' }, event);
  }

  if (devices.length > 500) {
    return errorResponse('Maximum 500 devices per bulk import', 400, { code: 'VAL_RNG_001' }, event);
  }

  const importBatchId = `import_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: { imei: string; error: string }[] = [];

  for (const device of devices) {
    try {
      if (!device.imei || !IMEI_REGEX.test(device.imei)) {
        errorDetails.push({ imei: device.imei || 'missing', error: 'Invalid IMEI format' });
        errors++;
        continue;
      }

      if (!device.manufacturer || !device.model) {
        errorDetails.push({ imei: device.imei, error: 'Missing manufacturer or model' });
        errors++;
        continue;
      }

      // Check for duplicate IMEI
      const { data: dup } = await db.from('devices')
        .select('id')
        .eq('imei', device.imei)
        .maybeSingle()
        .execute();

      if (dup) {
        skipped++;
        continue;
      }

      await db.from('devices').insert({
        imei: device.imei,
        serial_number: device.serial_number || null,
        manufacturer: device.manufacturer,
        model: device.model,
        device_type: device.device_type || 'smartphone',
        storage_gb: device.storage_gb || null,
        color: device.color || null,
        condition: device.condition || 'new',
        purchase_price_usd: device.purchase_price_usd || null,
        retail_price_usd: device.retail_price_usd || null,
        device_model_id: device.device_model_id || null,
        status: 'in_stock',
        location: device.location || body.default_location || 'Warehouse',
        lock_status: 'unlocked',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).execute();

      inserted++;
    } catch (err) {
      logger.error('Error importing device', { action: 'admin.devices.bulk_import', status: 'failed', errorMessage: err instanceof Error ? err.message : String(err) });
      errorDetails.push({ imei: device.imei || 'unknown', error: (err as Error).message });
      errors++;
    }
  }

  await auditLog(auth, 'device.bulk_import', 'device', null,
    `Bulk imported devices: ${inserted} inserted, ${skipped} skipped, ${errors} errors`, {
    import_batch_id: importBatchId,
    total: devices.length,
    inserted,
    skipped,
    errors,
  });

  return successResponse({
    import_batch_id: importBatchId,
    total: devices.length,
    inserted,
    skipped,
    errors,
    error_details: errorDetails.slice(0, 50),
  }, 200, event);
};

// ─── GET /admin/devices/stats ───

export const handleGetDeviceInventoryStats: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: rows } = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM devices WHERE deleted_at IS NULL GROUP BY status`
  );

  const stats: Record<string, number> = {
    in_stock: 0, assigned: 0, reserved: 0, sold: 0,
    returned: 0, repossessed: 0, damaged: 0, lost: 0, written_off: 0,
    locked: 0,
  };

  for (const row of rows) {
    stats[row.status] = parseInt(row.count);
  }

  // Get locked count separately (lock_status is independent of status)
  const { data: lockRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM devices WHERE lock_status = 'locked' AND deleted_at IS NULL`
  );
  stats.locked = parseInt(lockRows[0]?.count || '0');

  return successResponse(stats, 200, event);
};

// ─── GET /admin/devices/:id ───

export const handleGetDeviceById: RouteHandler = async (event, params, auth) => {
  const deviceId = params.id;

  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: rows } = await query(
    `SELECT d.*, c.full_name as customer_name, c.phone_number as customer_phone,
            dm.brand, dm.model_name as catalog_model_name
     FROM devices d
     LEFT JOIN customers c ON d.customer_id = c.id
     LEFT JOIN device_models dm ON d.device_model_id = dm.id
     WHERE d.id = $1 AND d.deleted_at IS NULL`,
    [deviceId]
  );

  if (!rows || rows.length === 0) {
    return errorResponse('Device not found', 404, {}, event);
  }

  return successResponse(rows[0], 200, event);
};

// ─── PATCH /admin/devices/:id ───

export const handleUpdateDevice: RouteHandler = async (event, params, auth) => {
  const deviceId = params.id;

  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const allowedFields = [
    'serial_number', 'manufacturer', 'model', 'device_type', 'storage_gb',
    'color', 'condition', 'purchase_price_usd', 'retail_price_usd',
    'device_model_id', 'status', 'location',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // Validate status if being changed
      if (field === 'status' && !(VALID_DEVICE_STATUSES as readonly string[]).includes(body[field])) {
        return errorResponse(`Invalid status: ${body[field]}`, 400, { code: 'VAL_FMT_001' }, event);
      }
      updates[field] = body[field];
    }
  }

  const { data: updated, error } = await db.from('devices')
    .update(updates)
    .eq('id', deviceId)
    .is('deleted_at', null)
    .execute();

  if (error) {
    logger.error('Error updating device', { action: 'admin.devices.update', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to update device', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('Device not found', 404, {}, event);
  }

  await auditLog(auth, 'device.update', 'device', deviceId, `Updated device: ${deviceId}`, updates);

  return successResponse(row, 200, event);
};

// ─── GET /admin/devices/:id/movements ───

export const handleGetDeviceMovements: RouteHandler = async (event, params, auth) => {
  const deviceId = params.id;

  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '50')));
  const offset = (page - 1) * limit;

  const { data: countRows } = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM inventory_movements WHERE device_id = $1',
    [deviceId]
  );
  const total = parseInt(countRows[0]?.count || '0');

  const { data: rows, error } = await query(
    `SELECT m.*, a.full_name as performed_by_name, a.email as performed_by_email
     FROM inventory_movements m
     LEFT JOIN admin_users a ON m.performed_by = a.id
     WHERE m.device_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2 OFFSET $3`,
    [deviceId, limit, offset]
  );

  if (error) {
    logger.error('Error fetching device movements', { action: 'admin.devices.movements', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to fetch device movements', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};
