import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';

const VALID_PRODUCT_CATEGORIES = ['smartphone', 'digital'] as const;
const PRODUCT_CODE_REGEX = /^[A-Za-z0-9_]{1,50}$/;

// ─── GET /admin/products ───

export const handleGetProducts: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = 'deleted_at IS NULL';
  const params: unknown[] = [];

  if (qs.category) {
    params.push(qs.category);
    whereClause += ` AND product_category = $${params.length}`;
  }

  if (qs.status) {
    params.push(qs.status);
    whereClause += ` AND status = $${params.length}`;
  }

  if (qs.search) {
    params.push(`%${qs.search}%`);
    const idx = params.length;
    whereClause += ` AND (product_name ILIKE $${idx} OR product_code ILIKE $${idx})`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM loan_products WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0');

  params.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT * FROM loan_products WHERE ${whereClause} ORDER BY display_order ASC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (error) {
    logger.error('Error fetching products', {
      action: 'admin.products.getAll',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to fetch products', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};

// ─── GET /admin/products/stats ───

export const handleGetProductStats: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: rows, error } = await query<{
    product_category: string;
    total_loans: string;
    total_volume: string;
  }>(
    `SELECT
       lp.product_category,
       COUNT(l.id) as total_loans,
       COALESCE(SUM(l.loan_amount_usd), 0) as total_volume
     FROM loan_products lp
     LEFT JOIN loans l ON l.product_id = lp.id AND l.status IN ('active', 'disbursed', 'approved', 'paid_off')
     WHERE lp.deleted_at IS NULL
     GROUP BY lp.product_category`,
    []
  );

  if (error) {
    logger.error('Error fetching product stats', {
      action: 'admin.products.stats',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to fetch product stats', 500, {}, event);
  }

  const stats: Record<string, { totalLoans: number; totalVolume: number }> = {};
  for (const row of rows) {
    stats[row.product_category] = {
      totalLoans: parseInt(row.total_loans) || 0,
      totalVolume: parseFloat(row.total_volume) || 0,
    };
  }

  return successResponse(stats, 200, event);
};

// ─── GET /admin/products/:id/loans-count ───

export const handleGetProductLoansCount: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const id = params.id;

  const { data: rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM loans WHERE product_id = $1 AND status IN ('active', 'disbursed', 'approved')`,
    [id]
  );

  return successResponse({ active_loans: parseInt(rows[0]?.count || '0') }, 200, event);
};

// ─── GET /admin/products/:id ───

export const handleGetProductById: RouteHandler = async (event, params, auth) => {
  const id = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: row } = await db.from('loan_products')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!row) {
    return errorResponse('Product not found', 404, {}, event);
  }

  // Fetch linked device models
  const { data: linkedModels } = await query<{
    id: string; device_model_id: string; brand: string; model_name: string; model_code: string;
    retail_price_usd: string; wholesale_price_usd: string; available_stock: string; is_active: boolean;
    storage_gb: string | null;
  }>(
    `SELECT pdm.id, pdm.device_model_id, dm.brand, dm.model_name, dm.model_code,
            dm.retail_price_usd, dm.wholesale_price_usd, dm.available_stock, dm.is_active, dm.storage_gb
     FROM product_device_models pdm
     JOIN device_models dm ON dm.id = pdm.device_model_id AND dm.deleted_at IS NULL
     WHERE pdm.product_id = $1
     ORDER BY dm.brand, dm.model_name`,
    [id]
  );

  // Count in-stock devices for linked models
  let inStockCount = 0;
  if (linkedModels && linkedModels.length > 0) {
    const modelIds = linkedModels.map(m => m.device_model_id);
    const { data: stockRows } = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM devices WHERE device_model_id = ANY($1) AND status = 'in_stock' AND deleted_at IS NULL`,
      [modelIds]
    );
    inStockCount = parseInt(stockRows[0]?.count || '0');
  }

  return successResponse({ ...row, linked_device_models: linkedModels || [], in_stock_device_count: inStockCount }, 200, event);
};

// ─── POST /admin/products ───

export const handleCreateProduct: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  // Validate required fields
  const requiredFields = ['product_code', 'product_name', 'product_category', 'product_type', 'min_amount_usd', 'max_amount_usd', 'min_term_months', 'max_term_months', 'interest_rate_monthly', 'interest_rate_annual'];
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return errorResponse(`Missing required field: ${field}`, 400, { code: 'VAL_REQ_001' }, event);
    }
  }

  // Validate product_code format
  if (!PRODUCT_CODE_REGEX.test(body.product_code)) {
    return errorResponse('product_code must be alphanumeric with underscores, max 50 chars', 400, { code: 'VAL_FMT_001' }, event);
  }

  // Validate product_category
  if (!VALID_PRODUCT_CATEGORIES.includes(body.product_category)) {
    return errorResponse('product_category must be smartphone or digital', 400, { code: 'VAL_FMT_001' }, event);
  }

  // Category-specific validations
  if (body.product_category === 'smartphone') {
    if (body.requires_device !== true) {
      return errorResponse('Smartphone products must have requires_device = true', 400, { code: 'VAL_FMT_001' }, event);
    }
    if (!body.deposit_percentage || body.deposit_percentage <= 0) {
      return errorResponse('Smartphone products must have deposit_percentage > 0', 400, { code: 'VAL_RNG_001' }, event);
    }
  }

  if (body.product_category === 'digital') {
    if (body.deposit_percentage && body.deposit_percentage !== 0) {
      return errorResponse('Digital products must have deposit_percentage = 0', 400, { code: 'VAL_FMT_001' }, event);
    }
    if (body.requires_organization_verification !== true) {
      return errorResponse('Digital products must have requires_organization_verification = true', 400, { code: 'VAL_FMT_001' }, event);
    }
  }

  // Range validations
  if (body.min_term_months >= body.max_term_months) {
    return errorResponse('min_term_months must be less than max_term_months', 400, { code: 'VAL_RNG_001' }, event);
  }
  if (body.min_amount_usd >= body.max_amount_usd) {
    return errorResponse('min_amount_usd must be less than max_amount_usd', 400, { code: 'VAL_RNG_001' }, event);
  }
  if (body.interest_rate_monthly <= 0) {
    return errorResponse('interest_rate_monthly must be greater than 0', 400, { code: 'VAL_RNG_001' }, event);
  }
  if (body.interest_rate_annual <= 0) {
    return errorResponse('interest_rate_annual must be greater than 0', 400, { code: 'VAL_RNG_001' }, event);
  }

  // Check uniqueness
  const { data: existing } = await db.from('loan_products')
    .select('id')
    .eq('product_code', body.product_code)
    .maybeSingle()
    .execute();

  if (existing) {
    return errorResponse('A product with this product_code already exists', 409, {}, event);
  }

  const insertData: Record<string, unknown> = {
    product_code: body.product_code,
    product_name: body.product_name,
    product_type: body.product_type,
    product_category: body.product_category,
    status: body.status || 'active',
    min_amount_usd: body.min_amount_usd,
    max_amount_usd: body.max_amount_usd,
    loan_term_months: body.loan_term_months || body.max_term_months,
    interest_rate_annual: body.interest_rate_annual,
    deposit_percentage: body.deposit_percentage || 0,
    min_deposit_usd: body.min_deposit_usd || 0,
    min_term_months: body.min_term_months,
    max_term_months: body.max_term_months,
    interest_rate_monthly: body.interest_rate_monthly,
    requires_device: body.requires_device || false,
    requires_organization_verification: body.requires_organization_verification || false,
    allowed_disbursement_methods: body.allowed_disbursement_methods ? JSON.stringify(body.allowed_disbursement_methods) : '["ecocash"]',
    max_active_loans: body.max_active_loans || 1,
    display_order: body.display_order || 0,
    description: body.description || null,
    fineract_product_id: body.fineract_product_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await db.from('loan_products').insert(insertData).execute();

  if (error) {
    logger.error('Error creating product', {
      action: 'admin.products.create',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to create product', 500, {}, event);
  }

  const row = Array.isArray(created) ? created[0] : created;

  await auditLog(auth, 'product.create', 'loan_product', row.id as string, `Created product: ${body.product_code}`, {
    product_code: body.product_code,
    product_category: body.product_category,
  });

  return successResponse(row, 201, event);
};

// ─── PATCH /admin/products/:id ───

export const handleUpdateProduct: RouteHandler = async (event, params, auth) => {
  const id = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const allowedFields = [
    'product_name', 'product_type', 'status', 'min_amount_usd', 'max_amount_usd',
    'loan_term_months', 'interest_rate_annual', 'deposit_percentage', 'min_deposit_usd',
    'min_term_months', 'max_term_months', 'interest_rate_monthly', 'requires_device',
    'requires_organization_verification', 'allowed_disbursement_methods', 'max_active_loans',
    'display_order', 'description', 'fineract_product_id',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'allowed_disbursement_methods' && typeof body[field] !== 'string') {
        updates[field] = JSON.stringify(body[field]);
      } else {
        updates[field] = body[field];
      }
    }
  }

  const { data: updated, error } = await db.from('loan_products')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .execute();

  if (error) {
    logger.error('Error updating product', {
      action: 'admin.products.update',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to update product', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('Product not found', 404, {}, event);
  }

  await auditLog(auth, 'product.update', 'loan_product', id, `Updated product: ${id}`, updates);

  return successResponse(row, 200, event);
};

// ─── DELETE /admin/products/:id ───

export const handleDeleteProduct: RouteHandler = async (event, params, auth) => {
  const id = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  // Safety check: cannot delete if product has active loans
  const { data: activeLoanRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM loans WHERE product_id = $1 AND status IN ('active', 'disbursed', 'approved')`,
    [id]
  );
  const activeCount = parseInt(activeLoanRows[0]?.count || '0');

  if (activeCount > 0) {
    return errorResponse('Cannot delete product with active loans', 400, { active_loans: activeCount }, event);
  }

  const { data: deleted, error } = await db.from('loan_products')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .execute();

  if (error) {
    logger.error('Error deleting product', {
      action: 'admin.products.delete',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to delete product', 500, {}, event);
  }

  const row = Array.isArray(deleted) ? deleted[0] : deleted;
  if (!row) {
    return errorResponse('Product not found', 404, {}, event);
  }

  await auditLog(auth, 'product.delete', 'loan_product', id, `Soft-deleted product: ${id}`);

  return successResponse({ message: 'Product deleted successfully' }, 200, event);
};

// ─── GET /admin/products/:id/device-models ───

export const handleGetProductDeviceModels: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const productId = params.id;

  const { data: rows, error } = await query<{
    id: string; device_model_id: string; brand: string; model_name: string; model_code: string;
    retail_price_usd: string; wholesale_price_usd: string; available_stock: string; is_active: boolean;
    storage_gb: string | null;
  }>(
    `SELECT pdm.id, pdm.device_model_id, dm.brand, dm.model_name, dm.model_code,
            dm.retail_price_usd, dm.wholesale_price_usd, dm.available_stock, dm.is_active, dm.storage_gb
     FROM product_device_models pdm
     JOIN device_models dm ON dm.id = pdm.device_model_id AND dm.deleted_at IS NULL
     WHERE pdm.product_id = $1
     ORDER BY dm.brand, dm.model_name`,
    [productId]
  );

  if (error) {
    return errorResponse('Failed to fetch linked device models', 500, {}, event);
  }

  return successResponse({ data: rows || [] }, 200, event);
};

// ─── POST /admin/products/:id/device-models ───

export const handleLinkDeviceModel: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const productId = params.id;
  const body = JSON.parse(event.body || '{}');
  const deviceModelIds: string[] = body.device_model_ids;

  if (!deviceModelIds || !Array.isArray(deviceModelIds) || deviceModelIds.length === 0) {
    return errorResponse('device_model_ids array is required', 400, { code: 'VAL_REQ_001' }, event);
  }

  // Verify product exists
  const { data: product } = await db.from('loan_products')
    .select('id, product_category')
    .eq('id', productId)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!product) {
    return errorResponse('Product not found', 404, {}, event);
  }

  // Insert links (ignore duplicates)
  const values = deviceModelIds.map((_, i) => `($1, $${i + 2}, now())`).join(', ');
  const insertParams = [productId, ...deviceModelIds];

  const { error } = await query(
    `INSERT INTO product_device_models (product_id, device_model_id, created_at)
     VALUES ${values}
     ON CONFLICT (product_id, device_model_id) DO NOTHING`,
    insertParams
  );

  if (error) {
    logger.error('Error linking device models', {
      action: 'admin.products.linkDeviceModels',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to link device models', 500, {}, event);
  }

  await auditLog(auth, 'product.linkDeviceModels', 'loan_product', productId,
    `Linked ${deviceModelIds.length} device model(s) to product`, { device_model_ids: deviceModelIds });

  return successResponse({ message: `Linked ${deviceModelIds.length} device model(s)` }, 200, event);
};

// ─── DELETE /admin/products/:id/device-models/:modelId ───

export const handleUnlinkDeviceModel: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const productId = params.id;
  const modelId = params.modelId;

  const { error } = await query(
    `DELETE FROM product_device_models WHERE product_id = $1 AND device_model_id = $2`,
    [productId, modelId]
  );

  if (error) {
    logger.error('Error unlinking device model', {
      action: 'admin.products.unlinkDeviceModel',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to unlink device model', 500, {}, event);
  }

  await auditLog(auth, 'product.unlinkDeviceModel', 'loan_product', productId,
    `Unlinked device model ${modelId} from product`, { device_model_id: modelId });

  return successResponse({ message: 'Device model unlinked' }, 200, event);
};
