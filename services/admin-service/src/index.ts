import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHash } from 'crypto';
import { db, query, queryOne } from '../../shared/clients/database';
import { getSecurityHeaders, successResponse, errorResponse } from '../../shared/utils/response';
import { getAuthContext, isAdminOrManager } from '../../shared/middleware/authorization';
import { getFineractClient } from '../../shared/clients/fineract';

const COGNITO_ADMIN_ROLES = ['super_admin', 'admin'];

/**
 * Admin Service Lambda Handler
 * Handles admin portal management (users, config, audit logs)
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path;
    const method = event.httpMethod;

    // OPTIONS preflight
    if (method === 'OPTIONS') {
      return { statusCode: 200, body: '', headers: getSecurityHeaders(event) };
    }

    const auth = getAuthContext(event);

    // Route matching
    if (path === '/admin/me' && method === 'GET') {
      return await handleGetCurrentAdmin(event, auth);
    }

    if (path === '/admin/users' && method === 'GET') {
      return await handleGetUsers(event, auth);
    }

    if (path === '/admin/users' && method === 'POST') {
      return await handleCreateUser(event, auth);
    }

    // Match /admin/users/{id}
    const userIdMatch = path.match(/^\/admin\/users\/([a-f0-9-]+)$/);
    if (userIdMatch) {
      const userId = userIdMatch[1];
      if (method === 'GET') {
        return await handleGetUserById(event, auth, userId);
      }
      if (method === 'PATCH') {
        return await handleUpdateUser(event, auth, userId);
      }
    }

    if (path === '/admin/config' && method === 'GET') {
      return await handleGetConfigs(event, auth);
    }

    // Match /admin/config/{id}
    const configIdMatch = path.match(/^\/admin\/config\/([a-f0-9-]+)$/);
    if (configIdMatch && method === 'PATCH') {
      return await handleUpdateConfig(event, auth, configIdMatch[1]);
    }

    if (path === '/admin/audit-logs' && method === 'GET') {
      return await handleGetAuditLogs(event, auth);
    }

    // ─── Product CRUD routes ───
    if (path === '/admin/products' && method === 'GET') {
      return await handleGetProducts(event, auth);
    }
    if (path === '/admin/products' && method === 'POST') {
      return await handleCreateProduct(event, auth);
    }
    const productIdMatch = path.match(/^\/admin\/products\/([a-f0-9-]+)$/);
    if (productIdMatch) {
      const productId = productIdMatch[1];
      if (method === 'GET') return await handleGetProductById(event, auth, productId);
      if (method === 'PATCH') return await handleUpdateProduct(event, auth, productId);
      if (method === 'DELETE') return await handleDeleteProduct(event, auth, productId);
    }

    // ─── Device Model CRUD routes ───
    if (path === '/admin/device-models' && method === 'GET') {
      return await handleGetDeviceModels(event, auth);
    }
    if (path === '/admin/device-models' && method === 'POST') {
      return await handleCreateDeviceModel(event, auth);
    }
    const deviceModelIdMatch = path.match(/^\/admin\/device-models\/([a-f0-9-]+)$/);
    if (deviceModelIdMatch) {
      const modelId = deviceModelIdMatch[1];
      if (method === 'GET') return await handleGetDeviceModelById(event, auth, modelId);
      if (method === 'PATCH') return await handleUpdateDeviceModel(event, auth, modelId);
      if (method === 'DELETE') return await handleDeleteDeviceModel(event, auth, modelId);
    }

    // ─── Organization routes ───
    // Match sub-routes first (import, members) before single-ID routes
    const orgImportMatch = path.match(/^\/admin\/organizations\/([a-f0-9-]+)\/import$/);
    if (orgImportMatch && method === 'POST') {
      return await handleImportOrgMembers(event, auth, orgImportMatch[1]);
    }
    const orgMembersMatch = path.match(/^\/admin\/organizations\/([a-f0-9-]+)\/members$/);
    if (orgMembersMatch && method === 'GET') {
      return await handleGetOrgMembers(event, auth, orgMembersMatch[1]);
    }
    if (path === '/admin/organizations' && method === 'GET') {
      return await handleGetOrganizations(event, auth);
    }
    if (path === '/admin/organizations' && method === 'POST') {
      return await handleCreateOrganization(event, auth);
    }
    const orgIdMatch = path.match(/^\/admin\/organizations\/([a-f0-9-]+)$/);
    if (orgIdMatch) {
      const orgId = orgIdMatch[1];
      if (method === 'GET') return await handleGetOrganizationById(event, auth, orgId);
      if (method === 'PATCH') return await handleUpdateOrganization(event, auth, orgId);
    }

    // ─── Inventory Management routes ───
    if (path === '/admin/devices' && method === 'GET') {
      return await handleGetDevices(event, auth);
    }
    if (path === '/admin/devices' && method === 'POST') {
      return await handleCreateDevice(event, auth);
    }
    if (path === '/admin/devices/bulk-import' && method === 'POST') {
      return await handleBulkImportDevices(event, auth);
    }
    if (path === '/admin/devices/stats' && method === 'GET') {
      return await handleGetDeviceInventoryStats(event, auth);
    }
    const deviceIdMatch = path.match(/^\/admin\/devices\/([a-f0-9-]+)$/);
    if (deviceIdMatch) {
      const deviceId = deviceIdMatch[1];
      if (method === 'GET') return await handleGetDeviceById(event, auth, deviceId);
      if (method === 'PATCH') return await handleUpdateDevice(event, auth, deviceId);
    }
    const deviceMovementsMatch = path.match(/^\/admin\/devices\/([a-f0-9-]+)\/movements$/);
    if (deviceMovementsMatch && method === 'GET') {
      return await handleGetDeviceMovements(event, auth, deviceMovementsMatch[1]);
    }

    // Inventory adjustments
    if (path === '/admin/inventory/adjustments' && method === 'GET') {
      return await handleGetAdjustments(event, auth);
    }
    if (path === '/admin/inventory/adjustments' && method === 'POST') {
      return await handleCreateAdjustment(event, auth);
    }
    const adjIdMatch = path.match(/^\/admin\/inventory\/adjustments\/([a-f0-9-]+)\/approve$/);
    if (adjIdMatch && method === 'POST') {
      return await handleApproveAdjustment(event, auth, adjIdMatch[1]);
    }

    // Stock transfers
    if (path === '/admin/inventory/transfers' && method === 'GET') {
      return await handleGetTransfers(event, auth);
    }
    if (path === '/admin/inventory/transfers' && method === 'POST') {
      return await handleCreateTransfer(event, auth);
    }
    const transferIdMatch = path.match(/^\/admin\/inventory\/transfers\/([a-f0-9-]+)$/);
    if (transferIdMatch && method === 'PATCH') {
      return await handleUpdateTransfer(event, auth, transferIdMatch[1]);
    }

    // ─── Dashboard routes ───
    if (path === '/api/v1/dashboard/metrics' && method === 'GET') {
      return await handleDashboardMetrics(event);
    }
    if (path === '/api/v1/dashboard/portfolio-at-risk' && method === 'GET') {
      return await handlePortfolioAtRisk(event);
    }
    if (path === '/api/v1/dashboard/daily-trends' && method === 'GET') {
      return await handleDailyTrends(event);
    }
    if (path === '/api/v1/dashboard/loans-by-status' && method === 'GET') {
      return await handleLoansByStatus(event);
    }
    if (path === '/api/v1/dashboard/recent-activity' && method === 'GET') {
      return await handleRecentActivity(event);
    }

    return errorResponse('Not Found', 404, {}, event);
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };

    if (err.statusCode === 403) {
      return errorResponse(err.message, 403, {}, event);
    }

    console.error('Admin service error:', err.message);
    return errorResponse('Internal Server Error', 500, {}, event);
  }
};

// ─── Helpers ───

interface AuthCtx {
  userId: string;
  email: string;
  roles: string[];
}

/** Map DB admin_users row to the frontend AdminUser shape. */
function mapAdminUser(row: Record<string, unknown>) {
  const fullName = (row.full_name as string) || '';
  const parts = fullName.split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  return {
    id: row.id,
    email: row.email,
    first_name: firstName,
    last_name: lastName,
    role: row.role,
    is_active: row.status === 'active',
    department: row.department || null,
    phone_number: row.phone_number || null,
    last_login_at: row.last_login_at || null,
    login_count: row.login_count || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Record an action in the audit_log table. */
async function auditLog(
  auth: AuthCtx,
  action: string,
  entityType: string,
  entityId: string | null,
  description: string,
  changes?: Record<string, unknown>
) {
  await db.from('audit_log').insert({
    user_id: auth.userId,
    user_type: 'admin',
    user_email: auth.email,
    action,
    entity_type: entityType,
    entity_id: entityId,
    description,
    changes: changes ? JSON.stringify(changes) : null,
    created_at: new Date().toISOString(),
  }).execute();
}

// ─── GET /admin/me ───

async function handleGetCurrentAdmin(
  event: APIGatewayProxyEvent,
  auth: AuthCtx
): Promise<APIGatewayProxyResult> {
  // Try to find in DB first
  const { data: row } = await db.from('admin_users')
    .select('*')
    .eq('email', auth.email)
    .maybeSingle()
    .execute();

  if (row) {
    return successResponse(mapAdminUser(row), 200, event);
  }

  // Fallback: build from Cognito claims (user may not be in DB yet)
  return successResponse({
    id: auth.userId,
    email: auth.email,
    first_name: '',
    last_name: '',
    role: auth.roles[0] || 'admin',
    is_active: true,
    department: null,
    last_login_at: null,
    login_count: 0,
    created_at: '',
    updated_at: '',
  }, 200, event);
}

// ─── GET /admin/users ───

async function handleGetUsers(
  event: APIGatewayProxyEvent,
  auth: AuthCtx
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = 'deleted_at IS NULL';
  const params: unknown[] = [];

  if (qs.role) {
    params.push(qs.role);
    whereClause += ` AND role = $${params.length}`;
  }

  if (qs.status === 'active') {
    whereClause += ` AND status = 'active'`;
  } else if (qs.status === 'inactive') {
    whereClause += ` AND status != 'active'`;
  }

  if (qs.search) {
    params.push(`%${qs.search}%`);
    const idx = params.length;
    whereClause += ` AND (full_name ILIKE $${idx} OR email ILIKE $${idx})`;
  }

  // Count
  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM admin_users WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0');

  // Fetch rows
  params.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT * FROM admin_users WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (error) {
    console.error('Error fetching admin users:', error.message);
    return errorResponse('Failed to fetch users', 500, {}, event);
  }

  return successResponse({
    data: rows.map(mapAdminUser),
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  }, 200, event);
}

// ─── GET /admin/users/:id ───

async function handleGetUserById(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  userId: string
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: row } = await db.from('admin_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
    .execute();

  if (!row) {
    return errorResponse('User not found', 404, {}, event);
  }

  return successResponse(mapAdminUser(row), 200, event);
}

// ─── POST /admin/users ───

async function handleCreateUser(
  event: APIGatewayProxyEvent,
  auth: AuthCtx
): Promise<APIGatewayProxyResult> {
  // Only super_admin can create users
  if (!auth.roles.some(r => COGNITO_ADMIN_ROLES.includes(r))) {
    return errorResponse('Only administrators can create users', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const { email, first_name, last_name, role } = body;

  if (!email || !first_name || !last_name || !role) {
    return errorResponse('Missing required fields: email, first_name, last_name, role', 400, {}, event);
  }

  // Check for existing user
  const { data: existing } = await db.from('admin_users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
    .execute();

  if (existing) {
    return errorResponse('A user with this email already exists', 409, {}, event);
  }

  // Create Cognito user if AWS SDK is available
  let cognitoCreated = false;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;

  if (userPoolId) {
    try {
      const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand } = await import('@aws-sdk/client-cognito-identity-provider');
      const cognito = new CognitoIdentityProviderClient({});

      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: first_name },
          { Name: 'family_name', Value: last_name },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      }));

      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: role,
      }));

      cognitoCreated = true;
    } catch (err) {
      console.error('Cognito user creation failed:', (err as Error).message);
      return errorResponse('Failed to create Cognito user', 500, {}, event);
    }
  }

  // Insert into database
  const fullName = `${first_name} ${last_name}`;
  const { data: newUser, error } = await db.from('admin_users')
    .insert({
      email,
      full_name: fullName,
      role,
      status: 'active',
      created_by: auth.userId,
    })
    .execute();

  if (error) {
    console.error('Error creating admin user:', error.message);
    return errorResponse('Failed to create user', 500, {}, event);
  }

  const created = Array.isArray(newUser) ? newUser[0] : newUser;

  await auditLog(auth, 'create', 'admin_user', created.id as string, `Created admin user: ${email}`, {
    email, role, cognito_created: cognitoCreated,
  });

  return successResponse(mapAdminUser(created), 201, event);
}

// ─── PATCH /admin/users/:id ───

async function handleUpdateUser(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  userId: string
): Promise<APIGatewayProxyResult> {
  if (!auth.roles.some(r => COGNITO_ADMIN_ROLES.includes(r))) {
    return errorResponse('Only administrators can update users', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.role !== undefined) {
    updates.role = body.role;
  }

  if (body.is_active !== undefined) {
    updates.status = body.is_active ? 'active' : 'inactive';
  }

  if (body.first_name !== undefined || body.last_name !== undefined) {
    // Fetch existing to merge names
    const { data: existing } = await db.from('admin_users')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
      .execute();

    if (existing) {
      const existingParts = ((existing as Record<string, unknown>).full_name as string || '').split(' ');
      const fn = body.first_name ?? existingParts[0] ?? '';
      const ln = body.last_name ?? existingParts.slice(1).join(' ') ?? '';
      updates.full_name = `${fn} ${ln}`;
    }
  }

  const { data: updated, error } = await db.from('admin_users')
    .update(updates)
    .eq('id', userId)
    .execute();

  if (error) {
    console.error('Error updating admin user:', error.message);
    return errorResponse('Failed to update user', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('User not found', 404, {}, event);
  }

  // Update Cognito group if role changed
  if (body.role && process.env.COGNITO_USER_POOL_ID) {
    try {
      const { CognitoIdentityProviderClient, AdminListGroupsForUserCommand, AdminRemoveUserFromGroupCommand, AdminAddUserToGroupCommand } = await import('@aws-sdk/client-cognito-identity-provider');
      const cognito = new CognitoIdentityProviderClient({});
      const userPoolId = process.env.COGNITO_USER_POOL_ID;

      // Get user email for Cognito lookup
      const userEmail = (row as Record<string, unknown>).email as string;

      // Remove from existing groups
      const groupsResp = await cognito.send(new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: userEmail,
      }));
      for (const group of groupsResp.Groups || []) {
        if (group.GroupName) {
          await cognito.send(new AdminRemoveUserFromGroupCommand({
            UserPoolId: userPoolId,
            Username: userEmail,
            GroupName: group.GroupName,
          }));
        }
      }

      // Add to new group
      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: userEmail,
        GroupName: body.role,
      }));
    } catch (err) {
      console.error('Cognito group update failed:', (err as Error).message);
      // Non-fatal -- DB was already updated
    }
  }

  await auditLog(auth, 'update', 'admin_user', userId, `Updated admin user: ${userId}`, updates);

  return successResponse(mapAdminUser(row), 200, event);
}

// ─── GET /admin/config ───

async function handleGetConfigs(
  event: APIGatewayProxyEvent,
  auth: AuthCtx
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data, error } = await db.from('system_config')
    .select('*')
    .order('config_key', { ascending: true })
    .execute();

  if (error) {
    console.error('Error fetching system configs:', error.message);
    return errorResponse('Failed to fetch configs', 500, {}, event);
  }

  return successResponse(data, 200, event);
}

// ─── PATCH /admin/config/:id ───

async function handleUpdateConfig(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  configId: string
): Promise<APIGatewayProxyResult> {
  if (!auth.roles.some(r => COGNITO_ADMIN_ROLES.includes(r))) {
    return errorResponse('Only administrators can update system config', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const { config_value, admin_id } = body;

  if (!config_value) {
    return errorResponse('Missing required field: config_value', 400, {}, event);
  }

  const { data: updated, error } = await db.from('system_config')
    .update({
      config_value: JSON.stringify(config_value),
      updated_by: admin_id || auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', configId)
    .execute();

  if (error) {
    console.error('Error updating config:', error.message);
    return errorResponse('Failed to update config', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('Config not found', 404, {}, event);
  }

  await auditLog(auth, 'update', 'system_config', configId, `Updated system config: ${configId}`);

  return successResponse(row, 200, event);
}

// ─── GET /admin/audit-logs ───

async function handleGetAuditLogs(
  event: APIGatewayProxyEvent,
  auth: AuthCtx
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = '1=1';
  const params: unknown[] = [];

  if (qs.user_type) {
    params.push(qs.user_type);
    whereClause += ` AND user_type = $${params.length}`;
  }

  if (qs.action) {
    params.push(qs.action);
    whereClause += ` AND action = $${params.length}`;
  }

  if (qs.entity_type) {
    params.push(qs.entity_type);
    whereClause += ` AND entity_type = $${params.length}`;
  }

  if (qs.date_from) {
    params.push(qs.date_from);
    whereClause += ` AND created_at >= $${params.length}::timestamptz`;
  }

  if (qs.date_to) {
    params.push(qs.date_to);
    whereClause += ` AND created_at <= $${params.length}::timestamptz`;
  }

  // Count
  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_log WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0');

  // Fetch
  params.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT * FROM audit_log WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (error) {
    console.error('Error fetching audit logs:', error.message);
    return errorResponse('Failed to fetch audit logs', 500, {}, event);
  }

  return successResponse({
    data: rows,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  }, 200, event);
}

// ═══════════════════════════════════════════════════════════════════════
// Product CRUD Handlers
// ═══════════════════════════════════════════════════════════════════════

const VALID_PRODUCT_CATEGORIES = ['smartphone', 'digital'] as const;
const PRODUCT_CODE_REGEX = /^[A-Za-z0-9_]{1,50}$/;

// ─── GET /admin/products ───

async function handleGetProducts(
  event: APIGatewayProxyEvent,
  auth: AuthCtx
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
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
    console.error('Error fetching products:', error.message);
    return errorResponse('Failed to fetch products', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
}

// ─── GET /admin/products/:id ───

async function handleGetProductById(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  productId: string
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: row } = await db.from('loan_products')
    .select('*')
    .eq('id', productId)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!row) {
    return errorResponse('Product not found', 404, {}, event);
  }

  return successResponse(row, 200, event);
}

// ─── POST /admin/products ───

async function handleCreateProduct(
  event: APIGatewayProxyEvent,
  auth: AuthCtx
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await db.from('loan_products').insert(insertData).execute();

  if (error) {
    console.error('Error creating product:', error.message);
    return errorResponse('Failed to create product', 500, {}, event);
  }

  const row = Array.isArray(created) ? created[0] : created;

  await auditLog(auth, 'product.create', 'loan_product', row.id as string, `Created product: ${body.product_code}`, {
    product_code: body.product_code,
    product_category: body.product_category,
  });

  return successResponse(row, 201, event);
}

// ─── PATCH /admin/products/:id ───

async function handleUpdateProduct(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  productId: string
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const allowedFields = [
    'product_name', 'product_type', 'status', 'min_amount_usd', 'max_amount_usd',
    'loan_term_months', 'interest_rate_annual', 'deposit_percentage', 'min_deposit_usd',
    'min_term_months', 'max_term_months', 'interest_rate_monthly', 'requires_device',
    'requires_organization_verification', 'allowed_disbursement_methods', 'max_active_loans',
    'display_order', 'description',
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
    .eq('id', productId)
    .is('deleted_at', null)
    .execute();

  if (error) {
    console.error('Error updating product:', error.message);
    return errorResponse('Failed to update product', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('Product not found', 404, {}, event);
  }

  await auditLog(auth, 'product.update', 'loan_product', productId, `Updated product: ${productId}`, updates);

  return successResponse(row, 200, event);
}

// ─── DELETE /admin/products/:id ───

async function handleDeleteProduct(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  productId: string
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  // Safety check: cannot delete if product has active loans
  const { data: activeLoanRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM loans WHERE product_id = $1 AND status IN ('active', 'disbursed', 'approved')`,
    [productId]
  );
  const activeCount = parseInt(activeLoanRows[0]?.count || '0');

  if (activeCount > 0) {
    return errorResponse('Cannot delete product with active loans', 400, { active_loans: activeCount }, event);
  }

  const { data: deleted, error } = await db.from('loan_products')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', productId)
    .is('deleted_at', null)
    .execute();

  if (error) {
    console.error('Error deleting product:', error.message);
    return errorResponse('Failed to delete product', 500, {}, event);
  }

  const row = Array.isArray(deleted) ? deleted[0] : deleted;
  if (!row) {
    return errorResponse('Product not found', 404, {}, event);
  }

  await auditLog(auth, 'product.delete', 'loan_product', productId, `Soft-deleted product: ${productId}`);

  return successResponse({ message: 'Product deleted successfully' }, 200, event);
}

// ═══════════════════════════════════════════════════════════════════════
// Device Model CRUD Handlers
// ═══════════════════════════════════════════════════════════════════════

// ─── GET /admin/device-models ───

async function handleGetDeviceModels(
  event: APIGatewayProxyEvent,
  auth: AuthCtx
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
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
    console.error('Error fetching device models:', error.message);
    return errorResponse('Failed to fetch device models', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
}

// ─── GET /admin/device-models/:id ───

async function handleGetDeviceModelById(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  modelId: string
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: row } = await db.from('device_models')
    .select('*')
    .eq('id', modelId)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!row) {
    return errorResponse('Device model not found', 404, {}, event);
  }

  return successResponse(row, 200, event);
}

// ─── POST /admin/device-models ───

async function handleCreateDeviceModel(
  event: APIGatewayProxyEvent,
  auth: AuthCtx
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
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
    console.error('Error creating device model:', error.message);
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
}

// ─── PATCH /admin/device-models/:id ───

async function handleUpdateDeviceModel(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  modelId: string
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
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
    .eq('id', modelId)
    .is('deleted_at', null)
    .execute();

  if (error) {
    console.error('Error updating device model:', error.message);
    return errorResponse('Failed to update device model', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('Device model not found', 404, {}, event);
  }

  await auditLog(auth, 'device_model.update', 'device_model', modelId, `Updated device model: ${modelId}`, updates);

  return successResponse(row, 200, event);
}

// ─── DELETE /admin/device-models/:id ───

async function handleDeleteDeviceModel(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  modelId: string
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: deleted, error } = await db.from('device_models')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', modelId)
    .is('deleted_at', null)
    .execute();

  if (error) {
    console.error('Error deleting device model:', error.message);
    return errorResponse('Failed to delete device model', 500, {}, event);
  }

  const row = Array.isArray(deleted) ? deleted[0] : deleted;
  if (!row) {
    return errorResponse('Device model not found', 404, {}, event);
  }

  await auditLog(auth, 'device_model.delete', 'device_model', modelId, `Soft-deleted device model: ${modelId}`);

  return successResponse({ message: 'Device model deleted successfully' }, 200, event);
}

// ═══════════════════════════════════════════════════════════════════════
// Organization CRUD Handlers
// ═══════════════════════════════════════════════════════════════════════

// ─── GET /admin/organizations ───

async function handleGetOrganizations(
  event: APIGatewayProxyEvent,
  auth: AuthCtx
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  let whereClause = 'deleted_at IS NULL';
  const params: unknown[] = [];

  if (qs.org_type) {
    params.push(qs.org_type);
    whereClause += ` AND org_type = $${params.length}`;
  }

  if (qs.is_active !== undefined) {
    const isActive = qs.is_active === 'true';
    whereClause += ` AND is_active = ${isActive}`;
  }

  if (qs.search) {
    params.push(`%${qs.search}%`);
    const idx = params.length;
    whereClause += ` AND (org_name ILIKE $${idx} OR org_code ILIKE $${idx})`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM organizations WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0');

  params.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT * FROM organizations WHERE ${whereClause} ORDER BY org_name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (error) {
    console.error('Error fetching organizations:', error.message);
    return errorResponse('Failed to fetch organizations', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
}

// ─── GET /admin/organizations/:id ───

async function handleGetOrganizationById(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  orgId: string
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: row } = await db.from('organizations')
    .select('*')
    .eq('id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!row) {
    return errorResponse('Organization not found', 404, {}, event);
  }

  // Get member count
  const { data: countRows } = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM organization_members WHERE organization_id = $1',
    [orgId]
  );
  const memberCount = parseInt(countRows[0]?.count || '0');

  return successResponse({ ...row, member_count: memberCount }, 200, event);
}

// ─── POST /admin/organizations ───

async function handleCreateOrganization(
  event: APIGatewayProxyEvent,
  auth: AuthCtx
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  const requiredFields = ['org_code', 'org_name', 'org_type'];
  for (const field of requiredFields) {
    if (!body[field]) {
      return errorResponse(`Missing required field: ${field}`, 400, { code: 'VAL_REQ_001' }, event);
    }
  }

  // Check uniqueness
  const { data: existing } = await db.from('organizations')
    .select('id')
    .eq('org_code', body.org_code)
    .maybeSingle()
    .execute();

  if (existing) {
    return errorResponse('An organization with this org_code already exists', 409, {}, event);
  }

  const insertData: Record<string, unknown> = {
    org_code: body.org_code,
    org_name: body.org_name,
    org_type: body.org_type,
    verification_method: body.verification_method || 'manual',
    api_endpoint: body.api_endpoint || null,
    api_credentials_secret: body.api_credentials_secret || null,
    scoring_trust_level: body.scoring_trust_level ?? 50,
    contact_name: body.contact_name || null,
    contact_email: body.contact_email || null,
    contact_phone: body.contact_phone || null,
    is_active: body.is_active !== undefined ? body.is_active : true,
    total_members: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await db.from('organizations').insert(insertData).execute();

  if (error) {
    console.error('Error creating organization:', error.message);
    return errorResponse('Failed to create organization', 500, {}, event);
  }

  const row = Array.isArray(created) ? created[0] : created;

  await auditLog(auth, 'organization.create', 'organization', row.id as string, `Created organization: ${body.org_name}`, {
    org_code: body.org_code,
    org_type: body.org_type,
  });

  return successResponse(row, 201, event);
}

// ─── PATCH /admin/organizations/:id ───

async function handleUpdateOrganization(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  orgId: string
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const allowedFields = [
    'org_name', 'org_type', 'verification_method', 'api_endpoint',
    'api_credentials_secret', 'scoring_trust_level', 'contact_name',
    'contact_email', 'contact_phone', 'is_active',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  const { data: updated, error } = await db.from('organizations')
    .update(updates)
    .eq('id', orgId)
    .is('deleted_at', null)
    .execute();

  if (error) {
    console.error('Error updating organization:', error.message);
    return errorResponse('Failed to update organization', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('Organization not found', 404, {}, event);
  }

  await auditLog(auth, 'organization.update', 'organization', orgId, `Updated organization: ${orgId}`, updates);

  return successResponse(row, 200, event);
}

// ─── POST /admin/organizations/:id/import ───

function hashNationalId(nationalId: string): string {
  return createHash('sha256').update(nationalId).digest('hex');
}

function maskPhone(phone: string): string {
  return phone.replace(/(\+?\d{3})\d{4}(\d{3})/, '$1****$2');
}

async function handleImportOrgMembers(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  orgId: string
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  // Verify org exists
  const { data: org } = await db.from('organizations')
    .select('id')
    .eq('id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!org) {
    return errorResponse('Organization not found', 404, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const members = body.members;

  if (!Array.isArray(members) || members.length === 0) {
    return errorResponse('members must be a non-empty array', 400, { code: 'VAL_REQ_001' }, event);
  }

  const importBatchId = `import_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const member of members) {
    try {
      if (!member.national_id && !member.phone_number) {
        errors++;
        continue;
      }

      const nationalIdHash = member.national_id ? hashNationalId(member.national_id) : null;

      // Check for duplicate by national_id_hash within this org
      if (nationalIdHash) {
        const { data: dup } = await db.from('organization_members')
          .select('id')
          .eq('organization_id', orgId)
          .eq('national_id_hash', nationalIdHash)
          .maybeSingle()
          .execute();

        if (dup) {
          skipped++;
          continue;
        }
      }

      // Try to match customer by phone number
      let customerId: string | null = null;
      if (member.phone_number) {
        const { data: customer } = await db.from('customers')
          .select('id')
          .eq('phone_number', member.phone_number)
          .maybeSingle()
          .execute();

        if (customer) {
          customerId = customer.id as string;
        }
      }

      await db.from('organization_members').insert({
        organization_id: orgId,
        national_id_hash: nationalIdHash,
        phone_number: member.phone_number || null,
        employee_number: member.employee_number || null,
        employment_status: member.employment_status || 'active',
        employment_start_date: member.employment_start_date || null,
        department: member.department || null,
        grade_level: member.grade_level || null,
        monthly_salary_usd: member.monthly_salary_usd || null,
        salary_verified: member.salary_verified || false,
        import_batch_id: importBatchId,
        data_source: body.data_source || 'manual',
        customer_id: customerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).execute();

      inserted++;
    } catch (err) {
      console.error('Error importing member:', (err as Error).message);
      errors++;
    }
  }

  // Update total_members count
  const { data: countRows } = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM organization_members WHERE organization_id = $1',
    [orgId]
  );
  const totalMembers = parseInt(countRows[0]?.count || '0');

  await db.from('organizations')
    .update({
      total_members: totalMembers,
      last_data_import_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)
    .execute();

  await auditLog(auth, 'organization.import_members', 'organization', orgId,
    `Imported members: ${inserted} inserted, ${skipped} skipped, ${errors} errors`, {
      import_batch_id: importBatchId,
      total: members.length,
      inserted,
      skipped,
      errors,
    });

  return successResponse({
    import_batch_id: importBatchId,
    total: members.length,
    inserted,
    skipped,
    errors,
  }, 200, event);
}

// ─── GET /admin/organizations/:id/members ───

async function handleGetOrgMembers(
  event: APIGatewayProxyEvent,
  auth: AuthCtx,
  orgId: string
): Promise<APIGatewayProxyResult> {
  if (!isAdminOrManager(auth as never)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  // Verify org exists
  const { data: org } = await db.from('organizations')
    .select('id')
    .eq('id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!org) {
    return errorResponse('Organization not found', 404, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  const { data: countRows } = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM organization_members WHERE organization_id = $1',
    [orgId]
  );
  const total = parseInt(countRows[0]?.count || '0');

  const { data: rows, error } = await query(
    'SELECT id, organization_id, phone_number, employee_number, employment_status, employment_start_date, department, grade_level, monthly_salary_usd, salary_verified, import_batch_id, data_source, customer_id, created_at, updated_at FROM organization_members WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [orgId, limit, offset]
  );

  if (error) {
    console.error('Error fetching organization members:', error.message);
    return errorResponse('Failed to fetch organization members', 500, {}, event);
  }

  // Mask phone numbers, exclude national_id_hash from response
  const maskedRows = rows.map((row: Record<string, unknown>) => ({
    ...row,
    phone_number: row.phone_number ? maskPhone(row.phone_number as string) : null,
  }));

  return successResponse({ data: maskedRows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/v1/dashboard/metrics
 * Returns executive-level KPIs for the dashboard home page.
 * Queries Lynia DB for counts/sums and optionally enriches with Fineract data.
 */
async function handleDashboardMetrics(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Run all DB queries in parallel for performance
  const [
    customersResult,
    loansResult,
    disbursedResult,
    revenueResult,
    collectionRateResult,
    defaultsResult,
    devicesResult,
    kycResult,
    pendingApprovalsResult,
    newCustomersResult,
    overdueResult,
  ] = await Promise.all([
    // Total active customers
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM customers WHERE status = $1', ['active']),
    // Active loans and outstanding balance
    queryOne<{ count: string; outstanding: string }>(
      "SELECT COUNT(*) as count, COALESCE(SUM(outstanding_balance_usd), 0) as outstanding FROM loans WHERE loan_status = 'active'"
    ),
    // Total disbursed
    queryOne<{ total: string }>(
      'SELECT COALESCE(SUM(loan_amount_usd), 0) as total FROM loans WHERE disbursement_date IS NOT NULL'
    ),
    // Monthly revenue (completed payments this month)
    queryOne<{ total: string }>(
      "SELECT COALESCE(SUM(payment_amount_usd), 0) as total FROM payments WHERE payment_status = 'completed' AND payment_date >= date_trunc('month', CURRENT_DATE)"
    ),
    // Collection rate: completed payments / total expected installments this month
    queryOne<{ collected: string; expected: string }>(
      `SELECT
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN payment_amount_usd ELSE 0 END), 0) as collected,
        COALESCE(SUM(payment_amount_usd), 1) as expected
      FROM payments
      WHERE payment_date >= date_trunc('month', CURRENT_DATE)`
    ),
    // Default rate: defaulted / (active + defaulted)
    queryOne<{ defaulted: string; total_active: string }>(
      `SELECT
        COALESCE(SUM(CASE WHEN loan_status = 'defaulted' THEN 1 ELSE 0 END), 0) as defaulted,
        COALESCE(COUNT(*), 1) as total_active
      FROM loans
      WHERE loan_status IN ('active', 'defaulted')`
    ),
    // Device counts
    queryOne<{ in_stock: string; active: string; locked: string }>(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'in_stock' THEN 1 ELSE 0 END), 0) as in_stock,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) as active,
        COALESCE(SUM(CASE WHEN lock_status = 'locked' THEN 1 ELSE 0 END), 0) as locked
      FROM devices`
    ),
    // Pending KYC
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM kyc_submissions WHERE status = 'pending_review'"
    ),
    // Pending loan approvals
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM loans WHERE loan_status = 'pending'"
    ),
    // New customers this month
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM customers WHERE created_at >= date_trunc('month', CURRENT_DATE)"
    ),
    // Overdue payments
    queryOne<{ count: string; amount: string }>(
      `SELECT COUNT(*) as count, COALESCE(SUM(outstanding_balance_usd), 0) as amount
      FROM loans WHERE loan_status = 'active' AND days_past_due > 0`
    ),
  ]);

  const totalCustomers = parseInt(customersResult.data?.count || '0');
  const activeLoans = parseInt(loansResult.data?.count || '0');
  const outstandingBalance = parseFloat(loansResult.data?.outstanding || '0');
  const totalDisbursed = parseFloat(disbursedResult.data?.total || '0');
  const monthlyRevenue = parseFloat(revenueResult.data?.total || '0');
  const collected = parseFloat(collectionRateResult.data?.collected || '0');
  const expected = parseFloat(collectionRateResult.data?.expected || '1');
  const collectionRate = expected > 0 ? collected / expected : 0;
  const defaulted = parseInt(defaultsResult.data?.defaulted || '0');
  const totalActiveDefaulted = parseInt(defaultsResult.data?.total_active || '1');
  const defaultRate = totalActiveDefaulted > 0 ? defaulted / totalActiveDefaulted : 0;
  const newCustomersThisMonth = parseInt(newCustomersResult.data?.count || '0');

  // Try to get Fineract-enriched data (portfolio outstanding, PAR30)
  let fineractOutstanding: number | null = null;
  let par30Pct: number | null = null;
  let fineractLastSync: string | null = null;
  let fineractDiscrepancies = 0;
  let disbursementsThisMonth = 0;

  try {
    const fineract = await getFineractClient();

    // Get all active Fineract-synced loans for accurate outstanding
    const { data: fLoans } = await query<{ fineract_loan_id: number; outstanding_balance_usd: number }>(
      "SELECT fineract_loan_id, outstanding_balance_usd FROM loans WHERE loan_status = 'active' AND fineract_loan_id IS NOT NULL LIMIT 500"
    );

    if (fLoans.length > 0) {
      let fTotal = 0;
      let overdueTotal = 0;
      for (const loan of fLoans.slice(0, 50)) {
        try {
          const fl = await fineract.getLoan(loan.fineract_loan_id);
          fTotal += fl.summary?.totalOutstanding ?? loan.outstanding_balance_usd;
          const overdue = fl.summary?.totalOverdue ?? 0;
          if (overdue > 0) {
            const overdueSince = fl.summary?.overdueSinceDate;
            if (overdueSince) {
              const days = Math.floor((Date.now() - new Date(overdueSince).getTime()) / 86400000);
              if (days > 30) overdueTotal += fl.summary?.totalOutstanding ?? 0;
            }
          }
        } catch {
          fTotal += loan.outstanding_balance_usd;
        }
      }
      fineractOutstanding = fTotal;
      par30Pct = fTotal > 0 ? overdueTotal / fTotal : 0;
    }

    // Get last reconciliation data
    const { data: reconcData } = await db.from('fineract_sync_log')
      .select('created_at, status')
      .eq('operation', 'reconcile')
      .order('created_at', { ascending: false })
      .limit(1)
      .execute();
    if (reconcData && reconcData.length > 0) {
      fineractLastSync = (reconcData[0] as Record<string, unknown>).created_at as string;
    }

    // Count discrepancies
    const { data: discrepData } = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM fineract_sync_log WHERE operation = 'reconcile' AND status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'"
    );
    fineractDiscrepancies = parseInt(discrepData?.count || '0');

    // Disbursements this month from payments
    const { data: disbData } = await queryOne<{ total: string }>(
      "SELECT COALESCE(SUM(loan_amount_usd), 0) as total FROM loans WHERE disbursement_date >= date_trunc('month', CURRENT_DATE)"
    );
    disbursementsThisMonth = parseFloat(disbData?.total || '0');
  } catch (e) {
    console.warn('[dashboard] Fineract enrichment failed, using DB-only data:', (e as Error).message);
  }

  const avgLoanSize = activeLoans > 0 ? outstandingBalance / activeLoans : 0;

  const metrics = {
    total_customers: totalCustomers,
    active_loans: activeLoans,
    total_disbursed_usd: totalDisbursed,
    outstanding_balance_usd: outstandingBalance,
    collection_rate: collectionRate,
    default_rate: defaultRate,
    devices_in_stock: parseInt(devicesResult.data?.in_stock || '0'),
    devices_active: parseInt(devicesResult.data?.active || '0'),
    devices_locked: parseInt(devicesResult.data?.locked || '0'),
    pending_kyc: parseInt(kycResult.data?.count || '0'),
    pending_approvals: parseInt(pendingApprovalsResult.data?.count || '0'),
    monthly_revenue_usd: monthlyRevenue,
    overdue_payments: parseInt(overdueResult.data?.count || '0'),
    overdue_amount_usd: parseFloat(overdueResult.data?.amount || '0'),
    new_customers_this_month: newCustomersThisMonth,
    // Fineract-enriched fields
    portfolio_outstanding_fineract: fineractOutstanding,
    par_30_pct: par30Pct,
    avg_loan_size_usd: avgLoanSize,
    disbursements_this_month: disbursementsThisMonth,
    fineract_last_sync: fineractLastSync,
    fineract_discrepancies: fineractDiscrepancies,
  };

  return successResponse(metrics, 200, event);
}

/**
 * GET /api/v1/dashboard/portfolio-at-risk
 * Returns PAR aging buckets (0-30, 31-60, 61-90, 90+ days).
 */
async function handlePortfolioAtRisk(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { data: rows } = await query<{ bucket: string; total: string }>(
    `SELECT
      CASE
        WHEN days_past_due BETWEEN 1 AND 30 THEN 'par_0_30'
        WHEN days_past_due BETWEEN 31 AND 60 THEN 'par_31_60'
        WHEN days_past_due BETWEEN 61 AND 90 THEN 'par_61_90'
        WHEN days_past_due > 90 THEN 'par_90_plus'
      END as bucket,
      COALESCE(SUM(outstanding_balance_usd), 0) as total
    FROM loans
    WHERE loan_status = 'active' AND days_past_due > 0
    GROUP BY bucket`
  );

  const par: Record<string, number> = {
    par_0_30: 0,
    par_31_60: 0,
    par_61_90: 0,
    par_90_plus: 0,
  };

  for (const row of rows) {
    if (row.bucket && par[row.bucket] !== undefined) {
      par[row.bucket] = parseFloat(row.total);
    }
  }

  return successResponse(par, 200, event);
}

/**
 * GET /api/v1/dashboard/daily-trends?days=30
 * Returns daily disbursement and collection amounts.
 */
async function handleDailyTrends(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const qs = event.queryStringParameters || {};
  const days = Math.min(Math.max(parseInt(qs.days || '30'), 1), 365);

  const { data: trends } = await query<{
    date: string;
    disbursements: string;
    collections: string;
    new_customers: string;
  }>(
    `WITH dates AS (
      SELECT generate_series(
        CURRENT_DATE - $1 * INTERVAL '1 day',
        CURRENT_DATE,
        '1 day'
      )::date as d
    )
    SELECT
      dates.d as date,
      COALESCE(SUM(CASE WHEN l.disbursement_date = dates.d THEN l.loan_amount_usd ELSE 0 END), 0) as disbursements,
      COALESCE((
        SELECT SUM(p.payment_amount_usd)
        FROM payments p
        WHERE p.payment_status = 'completed' AND p.payment_date::date = dates.d
      ), 0) as collections,
      COALESCE((
        SELECT COUNT(*)
        FROM customers c
        WHERE c.created_at::date = dates.d
      ), 0) as new_customers
    FROM dates
    LEFT JOIN loans l ON l.disbursement_date = dates.d
    GROUP BY dates.d
    ORDER BY dates.d ASC`,
    [days]
  );

  const result = trends.map((row) => ({
    date: row.date,
    disbursements: parseFloat(row.disbursements),
    collections: parseFloat(row.collections),
    new_customers: parseInt(row.new_customers),
  }));

  return successResponse(result, 200, event);
}

/**
 * GET /api/v1/dashboard/loans-by-status
 * Returns loan counts and total amounts grouped by status.
 */
async function handleLoansByStatus(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { data: rows } = await query<{ status: string; count: string; total_amount: string }>(
    `SELECT
      loan_status as status,
      COUNT(*) as count,
      COALESCE(SUM(loan_amount_usd), 0) as total_amount
    FROM loans
    GROUP BY loan_status
    ORDER BY count DESC`
  );

  const result = rows.map((row) => ({
    status: row.status,
    count: parseInt(row.count),
    total_amount: parseFloat(row.total_amount),
  }));

  return successResponse(result, 200, event);
}

/**
 * GET /api/v1/dashboard/recent-activity?limit=20
 * Returns the most recent audit log entries for the activity feed.
 */
async function handleRecentActivity(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const qs = event.queryStringParameters || {};
  const limit = Math.min(Math.max(parseInt(qs.limit || '20'), 1), 100);

  const { data: rows } = await query<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    description: string;
    user_email: string;
    created_at: string;
  }>(
    `SELECT id, action, entity_type, entity_id, description, user_email, created_at
    FROM audit_log
    ORDER BY created_at DESC
    LIMIT $1`,
    [limit]
  );

  const result = rows.map((row) => ({
    id: row.id,
    event_type: mapActionToEventType(row.action),
    description: row.description || `${row.action} on ${row.entity_type}`,
    resource_type: row.entity_type,
    resource_id: row.entity_id || '',
    created_at: row.created_at,
    admin_name: row.user_email ? row.user_email.split('@')[0] : undefined,
  }));

  return successResponse(result, 200, event);
}

/** Map audit log action to frontend event_type for icon rendering */
function mapActionToEventType(action: string): string {
  if (action.includes('create') || action.includes('register')) return 'create';
  if (action.includes('approve')) return 'approve';
  if (action.includes('reject')) return 'reject';
  if (action.includes('payment') || action.includes('repayment')) return 'payment';
  if (action.includes('lock')) return 'lock';
  if (action.includes('unlock')) return 'unlock';
  if (action.includes('login')) return 'login';
  return 'update';
}
