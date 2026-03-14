import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';

// ─── GET /admin/device-models ───

export const handleGetDeviceModels: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = 'deleted_at IS NULL';
  const params: unknown[] = [];

  if (qs.brand) {
    params.push(qs.brand);
    whereClause += ` AND brand = $${params.length}`;
  }

  if (qs.is_active !== undefined) {
    const isActive = qs.is_active === 'true';
    whereClause += ` AND is_active = ${isActive}`;
  }

  if (qs.search) {
    params.push(`%${qs.search}%`);
    const idx = params.length;
    whereClause += ` AND (model_name ILIKE $${idx} OR model_code ILIKE $${idx} OR brand ILIKE $${idx})`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM device_models WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0');

  params.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT * FROM device_models WHERE ${whereClause} ORDER BY brand ASC, model_name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (error) {
    logger.error('Error fetching device models', {
      action: 'admin.deviceModels.getAll',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to fetch device models', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};

// ─── GET /admin/device-models/:id ───

export const handleGetDeviceModelById: RouteHandler = async (event, params, auth) => {
  const id = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: row } = await db.from('device_models')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!row) {
    return errorResponse('Device model not found', 404, {}, event);
  }

  return successResponse(row, 200, event);
};

// ─── POST /admin/device-models ───

export const handleCreateDeviceModel: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  const requiredFields = ['brand', 'model_name', 'model_code', 'retail_price_usd', 'wholesale_price_usd'];
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return errorResponse(`Missing required field: ${field}`, 400, { code: 'VAL_REQ_001' }, event);
    }
  }

  // Check model_code uniqueness
  const { data: existing } = await db.from('device_models')
    .select('id')
    .eq('model_code', body.model_code)
    .maybeSingle()
    .execute();

  if (existing) {
    return errorResponse('A device model with this model_code already exists', 409, {}, event);
  }

  const insertData: Record<string, unknown> = {
    brand: body.brand,
    model_name: body.model_name,
    model_code: body.model_code,
    storage_gb: body.storage_gb || null,
    ram_gb: body.ram_gb || null,
    screen_size_inches: body.screen_size_inches || null,
    device_type: body.device_type || 'smartphone',
    retail_price_usd: body.retail_price_usd,
    wholesale_price_usd: body.wholesale_price_usd,
    min_deposit_percentage: body.min_deposit_percentage || null,
    max_term_months: body.max_term_months || null,
    is_active: body.is_active !== undefined ? body.is_active : true,
    available_stock: body.available_stock || 0,
    image_url: body.image_url || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await db.from('device_models').insert(insertData).execute();

  if (error) {
    logger.error('Error creating device model', {
      action: 'admin.deviceModels.create',
      status: 'failed',
      errorMessage: error.message,
    });
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      return errorResponse('A device model with this model_code already exists', 409, {}, event);
    }
    return errorResponse('Failed to create device model', 500, {}, event);
  }

  const row = Array.isArray(created) ? created[0] : created;

  await auditLog(auth, 'device_model.create', 'device_model', row.id as string, `Created device model: ${body.brand} ${body.model_name}`, {
    model_code: body.model_code,
    brand: body.brand,
  });

  return successResponse(row, 201, event);
};

// ─── PATCH /admin/device-models/:id ───

export const handleUpdateDeviceModel: RouteHandler = async (event, params, auth) => {
  const id = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const allowedFields = [
    'brand', 'model_name', 'model_code', 'storage_gb', 'ram_gb', 'screen_size_inches',
    'device_type', 'retail_price_usd', 'wholesale_price_usd', 'min_deposit_percentage',
    'max_term_months', 'is_active', 'available_stock', 'image_url',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  const { data: updated, error } = await db.from('device_models')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .execute();

  if (error) {
    logger.error('Error updating device model', {
      action: 'admin.deviceModels.update',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to update device model', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('Device model not found', 404, {}, event);
  }

  await auditLog(auth, 'device_model.update', 'device_model', id, `Updated device model: ${id}`, updates);

  return successResponse(row, 200, event);
};

// ─── DELETE /admin/device-models/:id ───

export const handleDeleteDeviceModel: RouteHandler = async (event, params, auth) => {
  const id = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: deleted, error } = await db.from('device_models')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .execute();

  if (error) {
    logger.error('Error deleting device model', {
      action: 'admin.deviceModels.delete',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to delete device model', 500, {}, event);
  }

  const row = Array.isArray(deleted) ? deleted[0] : deleted;
  if (!row) {
    return errorResponse('Device model not found', 404, {}, event);
  }

  await auditLog(auth, 'device_model.delete', 'device_model', id, `Soft-deleted device model: ${id}`);

  return successResponse({ message: 'Device model deleted successfully' }, 200, event);
};
