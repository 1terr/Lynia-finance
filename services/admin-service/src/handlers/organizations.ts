import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog, hashNationalId, maskPhone } from './helpers';

// ─── GET /admin/organizations/check-code ───

export const handleCheckOrgCode: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const code = (event.queryStringParameters?.code || '').trim().toUpperCase();

  if (!code) {
    return errorResponse('code query parameter is required', 400, { code: 'VAL_REQ_001' }, event);
  }

  const { data: existing } = await query<{ id: string }>(
    'SELECT id FROM organizations WHERE UPPER(org_code) = $1 AND deleted_at IS NULL',
    [code]
  );

  return successResponse({ available: !existing || existing.length === 0 }, 200, event);
};

// ─── GET /admin/organizations ───

export const handleGetOrganizations: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
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
    params.push(isActive);
    whereClause += ` AND is_active = $${params.length}`;
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
    logger.error('Error fetching organizations', { action: 'admin.organizations.list', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to fetch organizations', 500, {}, event);
  }

  return successResponse({ data: rows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};

// ─── POST /admin/organizations ───

export const handleCreateOrganization: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  const requiredFields = ['org_code', 'org_name', 'org_type'];
  for (const field of requiredFields) {
    if (!body[field]) {
      return errorResponse(`Missing required field: ${field}`, 400, { code: 'VAL_REQ_001' }, event);
    }
  }

  // Validate org_code format
  const ORG_CODE_REGEX = /^[A-Z0-9_]{2,50}$/;
  if (!ORG_CODE_REGEX.test(body.org_code)) {
    return errorResponse(
      'org_code must be 2-50 uppercase alphanumeric characters or underscores',
      400,
      { code: 'VAL_FMT_001' },
      event
    );
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
    logger.error('Error creating organization', { action: 'admin.organizations.create', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to create organization', 500, {}, event);
  }

  const row = Array.isArray(created) ? created[0] : created;

  await auditLog(auth, 'organization.create', 'organization', row.id as string, `Created organization: ${body.org_name}`, {
    org_code: body.org_code,
    org_type: body.org_type,
  });

  return successResponse(row, 201, event);
};

// ─── GET /admin/organizations/:id ───

export const handleGetOrganizationById: RouteHandler = async (event, params, auth) => {
  const orgId = params.id;

  if (!isAdminOrManager(auth)) {
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
};

// ─── PATCH /admin/organizations/:id ───

export const handleUpdateOrganization: RouteHandler = async (event, params, auth) => {
  const orgId = params.id;

  if (!isAdminOrManager(auth)) {
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
    logger.error('Error updating organization', { action: 'admin.organizations.update', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to update organization', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('Organization not found', 404, {}, event);
  }

  await auditLog(auth, 'organization.update', 'organization', orgId, `Updated organization: ${orgId}`, updates);

  return successResponse(row, 200, event);
};

// ─── POST /admin/organizations/:id/import ───

export const handleImportOrgMembers: RouteHandler = async (event, params, auth) => {
  const orgId = params.id;

  if (!isAdminOrManager(auth)) {
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

  if (members.length > 5000) {
    return errorResponse('Maximum 5000 members per import batch', 400, { code: 'VAL_RNG_001' }, event);
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
      logger.error('Error importing member', { action: 'admin.organizations.import_member', status: 'failed', errorMessage: err instanceof Error ? err.message : String(err) });
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
};

// ─── GET /admin/organizations/:id/members ───

export const handleGetOrgMembers: RouteHandler = async (event, params, auth) => {
  const orgId = params.id;

  if (!isAdminOrManager(auth)) {
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

  let whereClause = 'organization_id = $1';
  const filterParams: unknown[] = [orgId];

  if (qs.employment_status) {
    filterParams.push(qs.employment_status);
    whereClause += ` AND employment_status = $${filterParams.length}`;
  }

  if (qs.search) {
    filterParams.push(`%${qs.search}%`);
    const idx = filterParams.length;
    whereClause += ` AND (employee_number ILIKE $${idx} OR phone_number ILIKE $${idx})`;
  }

  const { data: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM organization_members WHERE ${whereClause}`,
    filterParams
  );
  const total = parseInt(countRows[0]?.count || '0');

  filterParams.push(limit, offset);
  const { data: rows, error } = await query(
    `SELECT id, organization_id, phone_number, employee_number, employment_status, employment_start_date, department, grade_level, monthly_salary_usd, salary_verified, import_batch_id, data_source, customer_id, created_at, updated_at FROM organization_members WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${filterParams.length - 1} OFFSET $${filterParams.length}`,
    filterParams
  );

  if (error) {
    logger.error('Error fetching organization members', { action: 'admin.organizations.members', status: 'failed', errorMessage: error.message });
    return errorResponse('Failed to fetch organization members', 500, {}, event);
  }

  // Mask phone numbers, exclude national_id_hash from response
  const maskedRows = rows.map((row: Record<string, unknown>) => ({
    ...row,
    phone_number: row.phone_number ? maskPhone(row.phone_number as string) : null,
  }));

  return successResponse({ data: maskedRows, total, page, limit, total_pages: Math.ceil(total / limit) }, 200, event);
};
