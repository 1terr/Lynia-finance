import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { mapAdminUser, auditLog, COGNITO_ADMIN_ROLES } from './helpers';

// ─── GET /admin/me ───

export const handleGetCurrentAdmin: RouteHandler = async (event, _params, auth) => {
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
};

// ─── GET /admin/users ───

export const handleGetUsers: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
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
    logger.error('Error fetching admin users', {
      action: 'admin.users.getUsers',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to fetch users', 500, {}, event);
  }

  return successResponse({
    data: rows.map(mapAdminUser),
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  }, 200, event);
};

// ─── POST /admin/users ───

export const handleCreateUser: RouteHandler = async (event, _params, auth) => {
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
      logger.error('Cognito user creation failed', {
        action: 'admin.users.createUser',
        status: 'failed',
        errorMessage: (err as Error).message,
      });
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
    logger.error('Error creating admin user', {
      action: 'admin.users.createUser',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to create user', 500, {}, event);
  }

  const created = Array.isArray(newUser) ? newUser[0] : newUser;

  await auditLog(auth, 'create', 'admin_user', created.id as string, `Created admin user: ${email}`, {
    email, role, cognito_created: cognitoCreated,
  });

  return successResponse(mapAdminUser(created), 201, event);
};

// ─── GET /admin/users/:id ───

export const handleGetUserById: RouteHandler = async (event, params, auth) => {
  const id = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: row } = await db.from('admin_users')
    .select('*')
    .eq('id', id)
    .maybeSingle()
    .execute();

  if (!row) {
    return errorResponse('User not found', 404, {}, event);
  }

  return successResponse(mapAdminUser(row), 200, event);
};

// ─── PATCH /admin/users/:id ───

export const handleUpdateUser: RouteHandler = async (event, params, auth) => {
  const id = params.id;

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
      .eq('id', id)
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
    .eq('id', id)
    .execute();

  if (error) {
    logger.error('Error updating admin user', {
      action: 'admin.users.updateUser',
      status: 'failed',
      errorMessage: error.message,
    });
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
      logger.warn('Cognito group update failed', {
        action: 'admin.users.updateUser',
        status: 'failed',
        errorMessage: (err as Error).message,
      });
      // Non-fatal -- DB was already updated
    }
  }

  await auditLog(auth, 'update', 'admin_user', id, `Updated admin user: ${id}`, updates);

  return successResponse(mapAdminUser(row), 200, event);
};
