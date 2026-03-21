import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';

// ─── Helpers ───

/** PostgreSQL returns DECIMAL columns as strings; parse them to numbers for the frontend. */
function parseDistributorNumerics<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    total_revenue_usd: parseFloat(String(row.total_revenue_usd ?? '0')) || 0,
    total_commissions_earned: parseFloat(String(row.total_commissions_earned ?? '0')) || 0,
    total_commissions_paid: parseFloat(String(row.total_commissions_paid ?? '0')) || 0,
    pending_commissions: parseFloat(String(row.pending_commissions ?? '0')) || 0,
    commission_rate: parseFloat(String(row.commission_rate ?? '0')) || 0,
    total_devices_distributed: parseInt(String(row.total_devices_distributed ?? row.total_devices_sold ?? '0'), 10) || 0,
  };
}

// ─── GET /admin/distributors ───

export const handleGetDistributors: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
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

  if (qs.search) {
    params.push(`%${qs.search}%`);
    const idx = params.length;
    whereClause += ` AND (business_name ILIKE $${idx} OR contact_person ILIKE $${idx} OR phone_number ILIKE $${idx})`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM distributors WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0');

  params.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT * FROM distributors WHERE ${whereClause} ORDER BY business_name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (error) {
    logger.error('Error fetching distributors', { action: 'admin.distributors.list', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to fetch distributors', 500, {}, event);
  }

  const parsed = rows.map(parseDistributorNumerics);
  return successResponse({ data: parsed, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};

// ─── GET /admin/distributors/stats ───

export const handleGetDistributorStats: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  // Try new column name first, fall back to old name if migration 034 hasn't been applied
  let { data: rows, error } = await query<{
    total: string;
    active: string;
    total_revenue_usd: string;
    total_devices_distributed: string;
  }>(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'active') as active,
       COALESCE(SUM(total_revenue_usd), 0) as total_revenue_usd,
       COALESCE(SUM(total_devices_distributed), 0) as total_devices_distributed
     FROM distributors
     WHERE deleted_at IS NULL`
  );

  if (error?.message?.includes('total_devices_distributed')) {
    logger.info('Falling back to total_devices_sold column', { action: 'admin.distributors.stats' });
    ({ data: rows, error } = await query<{
      total: string;
      active: string;
      total_revenue_usd: string;
      total_devices_distributed: string;
    }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'active') as active,
         COALESCE(SUM(total_revenue_usd), 0) as total_revenue_usd,
         COALESCE(SUM(total_devices_sold), 0) as total_devices_distributed
       FROM distributors
       WHERE deleted_at IS NULL`
    ));
  }

  if (error) {
    logger.error('Error fetching distributor stats', { action: 'admin.distributors.stats', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to fetch distributor stats', 500, {}, event);
  }

  const row = rows[0];
  return successResponse({
    total: parseInt(row?.total || '0'),
    active: parseInt(row?.active || '0'),
    total_revenue_usd: parseFloat(row?.total_revenue_usd || '0'),
    total_devices_distributed: parseInt(row?.total_devices_distributed || '0'),
  }, 200, event);
};

// ─── POST /admin/distributors ───

export const handleCreateDistributor: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  const requiredFields = ['business_name', 'contact_person', 'phone_number'];
  for (const field of requiredFields) {
    if (!body[field]) {
      return errorResponse(`Missing required field: ${field}`, 400, { code: 'VAL_REQ_001' }, event);
    }
  }

  if (body.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return errorResponse('Invalid email format', 400, { code: 'VAL_FMT_001' }, event);
    }
  }

  // Check phone uniqueness
  const { data: existing } = await db.from('distributors')
    .select('id')
    .eq('phone_number', body.phone_number)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (existing) {
    return errorResponse('A distributor with this phone number already exists', 409, {}, event);
  }

  // Create Cognito user
  let cognitoUsername: string | null = null;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;

  if (userPoolId) {
    try {
      const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand } = await import('@aws-sdk/client-cognito-identity-provider');
      const cognito = new CognitoIdentityProviderClient({});
      const uuidPart = Math.random().toString(36).substring(2, 10);
      cognitoUsername = `dist_${uuidPart}`;

      const userAttributes = [
        { Name: 'phone_number', Value: body.phone_number },
        { Name: 'phone_number_verified', Value: 'true' },
        { Name: 'name', Value: body.contact_person },
      ];
      if (body.email) {
        userAttributes.push(
          { Name: 'email', Value: body.email },
          { Name: 'email_verified', Value: 'true' },
        );
      }

      const deliveryMediums: ('EMAIL' | 'SMS')[] = [];
      if (body.email) deliveryMediums.push('EMAIL');
      deliveryMediums.push('SMS');

      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: cognitoUsername,
        UserAttributes: userAttributes,
        DesiredDeliveryMediums: deliveryMediums,
      }));

      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: cognitoUsername,
        GroupName: 'distributor',
      }));
    } catch (err) {
      logger.error('Cognito user creation failed for distributor', {
        action: 'admin.distributors.create',
        status: 'failed',
        errorMessage: (err as Error).message,
      });
      // Continue without Cognito — still create distributor record
      cognitoUsername = null;
    }
  }

  const insertData: Record<string, unknown> = {
    business_name: body.business_name,
    contact_person: body.contact_person,
    phone_number: body.phone_number,
    email: body.email || null,
    address_line1: body.address_line1 || null,
    city: body.city || null,
    province: body.province || null,
    bank_name: body.bank_name || null,
    account_number: body.account_number || null,
    account_name: body.account_name || null,
    status: body.status || 'active',
    approved_by: auth.userId,
    approved_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await db.from('distributors').insert(insertData).execute();

  if (error) {
    logger.error('Error creating distributor', { action: 'admin.distributors.create', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to create distributor', 500, {}, event);
  }

  const row = Array.isArray(created) ? created[0] : created;

  await auditLog(auth, 'distributor.create', 'distributor', row.id as string, `Created distributor: ${body.business_name}`, {
    business_name: body.business_name,
    phone_number: body.phone_number,
    cognito_username: cognitoUsername,
  });

  return successResponse({ ...row, cognito_username: cognitoUsername }, 201, event);
};

// ─── GET /admin/distributors/:id ───

export const handleGetDistributorById: RouteHandler = async (event, params, auth) => {
  const distributorId = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: row } = await db.from('distributors')
    .select('*')
    .eq('id', distributorId)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!row) {
    return errorResponse('Distributor not found', 404, {}, event);
  }

  // Enrichment: inventory count, commission totals, handover count
  const { data: enrichment } = await query<{
    inventory_count: string;
    total_commissions: string;
    pending_commissions: string;
    handover_count: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM agent_inventory WHERE distributor_id = $1 AND status = 'available') as inventory_count,
       COALESCE((SELECT SUM(commission_amount_usd) FROM distributor_commissions WHERE distributor_id = $1), 0) as total_commissions,
       COALESCE((SELECT SUM(commission_amount_usd) FROM distributor_commissions WHERE distributor_id = $1 AND payment_status = 'pending'), 0) as pending_commissions,
       (SELECT COUNT(*) FROM device_handovers WHERE distributor_id = $1) as handover_count`,
    [distributorId]
  );

  const stats = enrichment[0];
  const parsedRow = parseDistributorNumerics(row);
  return successResponse({
    ...parsedRow,
    inventory_count: parseInt(stats?.inventory_count || '0'),
    total_commissions: parseFloat(stats?.total_commissions || '0'),
    pending_commissions: parseFloat(stats?.pending_commissions || '0'),
    handover_count: parseInt(stats?.handover_count || '0'),
  }, 200, event);
};

// ─── PATCH /admin/distributors/:id ───

export const handleUpdateDistributor: RouteHandler = async (event, params, auth) => {
  const distributorId = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const allowedFields = [
    'business_name', 'contact_person', 'phone_number', 'email',
    'address_line1', 'city', 'province',
    'bank_name', 'account_number', 'account_name',
    'status',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  const { data: updated, error } = await db.from('distributors')
    .update(updates)
    .eq('id', distributorId)
    .is('deleted_at', null)
    .execute();

  if (error) {
    logger.error('Error updating distributor', { action: 'admin.distributors.update', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to update distributor', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('Distributor not found', 404, {}, event);
  }

  await auditLog(auth, 'distributor.update', 'distributor', distributorId, `Updated distributor: ${distributorId}`, updates);

  return successResponse(row, 200, event);
};

// ─── GET /admin/distributors/:id/inventory ───

export const handleGetDistributorInventory: RouteHandler = async (event, params, auth) => {
  const distributorId = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = 'ai.distributor_id = $1';
  const sqlParams: unknown[] = [distributorId];

  if (qs.status) {
    sqlParams.push(qs.status);
    whereClause += ` AND ai.status = $${sqlParams.length}`;
  }

  if (qs.search) {
    sqlParams.push(`%${qs.search}%`);
    const idx = sqlParams.length;
    whereClause += ` AND (d.imei ILIKE $${idx} OR d.manufacturer ILIKE $${idx} OR d.model ILIKE $${idx})`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM agent_inventory ai LEFT JOIN devices d ON ai.device_id = d.id WHERE ${whereClause}`,
    sqlParams
  );
  const total = parseInt(countRows[0]?.count || '0');

  sqlParams.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT ai.id, ai.device_id, ai.status, ai.assigned_date, ai.sold_date, ai.quantity,
            d.imei, d.manufacturer, d.model, d.retail_price_usd, d.condition, d.status as device_status
     FROM agent_inventory ai
     LEFT JOIN devices d ON ai.device_id = d.id
     WHERE ${whereClause}
     ORDER BY ai.assigned_date DESC
     LIMIT $${sqlParams.length - 1} OFFSET $${sqlParams.length}`,
    sqlParams
  );

  if (error) {
    logger.error('Error fetching distributor inventory', { action: 'admin.distributors.inventory', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to fetch inventory', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};

// ─── GET /admin/distributors/:id/handovers ───

export const handleGetDistributorHandovers: RouteHandler = async (event, params, auth) => {
  const distributorId = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = 'h.distributor_id = $1';
  const sqlParams: unknown[] = [distributorId];

  if (qs.status) {
    sqlParams.push(qs.status);
    whereClause += ` AND h.status = $${sqlParams.length}`;
  }

  if (qs.search) {
    sqlParams.push(`%${qs.search}%`);
    const idx = sqlParams.length;
    whereClause += ` AND (CONCAT(c.first_name, ' ', c.last_name) ILIKE $${idx} OR d.imei ILIKE $${idx})`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM device_handovers h
     LEFT JOIN customers c ON h.customer_id = c.id
     LEFT JOIN devices d ON h.device_id = d.id
     WHERE ${whereClause}`,
    sqlParams
  );
  const total = parseInt(countRows[0]?.count || '0');

  sqlParams.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT h.id, h.loan_id, h.customer_id, h.device_id, h.status,
            h.scheduled_date, h.completed_at, h.created_at,
            CONCAT(c.first_name, ' ', c.last_name) as customer_name,
            c.phone_number as customer_phone,
            d.imei as device_imei,
            CONCAT(d.manufacturer, ' ', d.model) as device_model
     FROM device_handovers h
     LEFT JOIN customers c ON h.customer_id = c.id
     LEFT JOIN devices d ON h.device_id = d.id
     WHERE ${whereClause}
     ORDER BY h.created_at DESC
     LIMIT $${sqlParams.length - 1} OFFSET $${sqlParams.length}`,
    sqlParams
  );

  if (error) {
    logger.error('Error fetching distributor handovers', { action: 'admin.distributors.handovers', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to fetch handovers', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};

// ─── GET /admin/distributors/:id/transfers ───

export const handleGetDistributorTransfers: RouteHandler = async (event, params, auth) => {
  const distributorId = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = '(t.to_distributor_id = $1 OR t.from_distributor_id = $1)';
  const sqlParams: unknown[] = [distributorId];

  if (qs.status) {
    sqlParams.push(qs.status);
    whereClause += ` AND t.status = $${sqlParams.length}`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM stock_transfers t
     WHERE ${whereClause}`,
    sqlParams
  );
  const total = parseInt(countRows[0]?.count || '0');

  sqlParams.push(limit, offset);
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
     LIMIT $${sqlParams.length - 1} OFFSET $${sqlParams.length}`,
    sqlParams
  );

  if (error) {
    logger.error('Error fetching distributor transfers', { action: 'admin.distributors.transfers', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to fetch transfers', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};

// ─── GET /admin/distributors/:id/commissions ───

export const handleGetDistributorCommissions: RouteHandler = async (event, params, auth) => {
  const distributorId = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  const { data: countRows } = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM distributor_commissions WHERE distributor_id = $1',
    [distributorId]
  );
  const total = parseInt(countRows[0]?.count || '0');

  const { data: rows, error } = await query(
    `SELECT dc.id, dc.loan_id, dc.device_id, dc.commission_amount_usd,
            dc.commission_percentage, dc.device_retail_price_usd,
            dc.payment_status, dc.created_at,
            d.imei as device_imei,
            CONCAT(d.manufacturer, ' ', d.model) as device_model
     FROM distributor_commissions dc
     LEFT JOIN devices d ON dc.device_id = d.id
     WHERE dc.distributor_id = $1
     ORDER BY dc.created_at DESC
     LIMIT $2 OFFSET $3`,
    [distributorId, limit, offset]
  );

  if (error) {
    logger.error('Error fetching distributor commissions', { action: 'admin.distributors.commissions', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to fetch commissions', 500, {}, event);
  }

  // Summary
  const { data: summary } = await query<{
    total_earned: string;
    total_paid: string;
    pending: string;
  }>(
    `SELECT
       COALESCE(SUM(commission_amount_usd), 0) as total_earned,
       COALESCE(SUM(commission_amount_usd) FILTER (WHERE payment_status = 'paid'), 0) as total_paid,
       COALESCE(SUM(commission_amount_usd) FILTER (WHERE payment_status = 'pending'), 0) as pending
     FROM distributor_commissions
     WHERE distributor_id = $1`,
    [distributorId]
  );

  const s = summary[0];
  return successResponse({
    data: rows,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
    summary: {
      total_earned: parseFloat(s?.total_earned || '0'),
      total_paid: parseFloat(s?.total_paid || '0'),
      pending: parseFloat(s?.pending || '0'),
    },
  }, 200, event);
};

// ─── POST /admin/distributors/:id/commissions/pay ───

export const handleBulkPayCommissions: RouteHandler = async (event, params, auth) => {
  const distributorId = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const commissionIds = body.commission_ids;

  if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
    return errorResponse('commission_ids must be a non-empty array', 400, { code: 'VAL_REQ_001' }, event);
  }

  // Verify all commissions belong to this distributor and are pending
  const placeholders = commissionIds.map((_: string, i: number) => `$${i + 2}`).join(', ');
  const { data: valid } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM distributor_commissions
     WHERE distributor_id = $1 AND payment_status = 'pending' AND id IN (${placeholders})`,
    [distributorId, ...commissionIds]
  );

  const validCount = parseInt(valid[0]?.count || '0');
  if (validCount !== commissionIds.length) {
    return errorResponse(
      `Only ${validCount} of ${commissionIds.length} commissions are valid pending commissions for this distributor`,
      400, { code: 'VAL_FMT_001' }, event
    );
  }

  // Get total amount before updating
  const { data: amountRows } = await query<{ total_amount: string }>(
    `SELECT COALESCE(SUM(commission_amount_usd), 0) as total_amount
     FROM distributor_commissions
     WHERE distributor_id = $1 AND payment_status = 'pending' AND id IN (${placeholders})`,
    [distributorId, ...commissionIds]
  );
  const totalAmount = parseFloat(amountRows[0]?.total_amount || '0');

  const now = new Date().toISOString();
  const { error } = await query(
    `UPDATE distributor_commissions
     SET payment_status = 'paid', paid_at = $1, paid_by = $2, updated_at = $1
     WHERE distributor_id = $3 AND id IN (${placeholders})`,
    [now, auth.userId, distributorId, ...commissionIds]
  );

  if (error) {
    logger.error('Error paying commissions', { action: 'admin.distributors.commissions.pay', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to pay commissions', 500, {}, event);
  }

  await auditLog(auth, 'distributor.commissions.pay', 'distributor', distributorId,
    `Marked ${commissionIds.length} commissions as paid`, { commission_ids: commissionIds });

  return successResponse({ paid: commissionIds.length, total: totalAmount }, 200, event);
};
