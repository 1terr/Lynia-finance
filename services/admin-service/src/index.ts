import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db, query } from '../../shared/clients/database';
import { getSecurityHeaders, successResponse, errorResponse } from '../../shared/utils/response';
import { getAuthContext, isAdminOrManager } from '../../shared/middleware/authorization';

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
