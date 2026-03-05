import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse, notFoundResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';

// ─── GET /api/v1/customers ───

export const handleGetCustomers: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['c.deleted_at IS NULL'];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (qs.status) {
    conditions.push(`c.status = $${paramIdx++}`);
    values.push(qs.status);
  }

  if (qs.kyc_status) {
    // Map frontend 'verified' to DB 'verified' and 'submitted' to 'in_review'
    const mapped = qs.kyc_status === 'submitted' ? 'in_review' : qs.kyc_status;
    conditions.push(`c.kyc_status = $${paramIdx++}`);
    values.push(mapped);
  }

  if (qs.search) {
    const term = `%${qs.search}%`;
    conditions.push(
      `(CONCAT(c.first_name, ' ', c.last_name) ILIKE $${paramIdx} OR c.phone_number ILIKE $${paramIdx} OR c.email ILIKE $${paramIdx})`
    );
    paramIdx++;
    values.push(term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM customers c ${whereClause}`,
    values
  );
  const total = parseInt(countResult.data?.count || '0');

  // Fetch with latest credit score via lateral join
  const result = await query(
    `SELECT
      c.id,
      c.phone_number,
      c.email,
      CONCAT(c.first_name, ' ', c.last_name) AS full_name,
      c.first_name,
      c.last_name,
      c.whatsapp_number,
      c.date_of_birth,
      c.gender,
      c.physical_address,
      c.province,
      c.city,
      c.employment_status,
      c.employment_type,
      c.monthly_income_usd,
      c.kyc_status,
      c.risk_level,
      c.status,
      c.created_at,
      c.updated_at,
      cs.scaled_score AS credit_score
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT scaled_score FROM credit_scores
      WHERE customer_id = c.id
      ORDER BY calculated_at DESC
      LIMIT 1
    ) cs ON true
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...values, limit, offset]
  );

  if (result.error) {
    logger.error('Customer list query failed', {
      action: 'customers.list',
      status: 'failed',
      errorMessage: result.error.message,
    });
    return errorResponse('Failed to fetch customers', 500, {}, event);
  }

  return successResponse({
    data: result.data,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  }, 200, event);
};

// ─── GET /api/v1/customers/:id ───

export const handleGetCustomerById: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const result = await queryOne(
    `SELECT
      c.*,
      CONCAT(c.first_name, ' ', c.last_name) AS full_name,
      cs.scaled_score AS credit_score
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT scaled_score FROM credit_scores
      WHERE customer_id = c.id
      ORDER BY calculated_at DESC
      LIMIT 1
    ) cs ON true
    WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [params.id]
  );

  if (!result.data) {
    return notFoundResponse('Customer', event);
  }

  return successResponse(result.data, 200, event);
};

// ─── PATCH /api/v1/customers/:id/status ───

export const handleUpdateCustomerStatus: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const { status } = body;

  if (!status || !['active', 'inactive', 'blocked'].includes(status)) {
    return errorResponse('Invalid status. Must be active, inactive, or blocked', 400, {}, event);
  }

  const now = new Date().toISOString();
  const result = await query(
    `UPDATE customers SET status = $1, updated_at = $2
     WHERE id = $3 AND deleted_at IS NULL
     RETURNING id`,
    [status, now, params.id]
  );

  if (!result.data || result.data.length === 0) {
    return notFoundResponse('Customer', event);
  }

  await auditLog(auth, 'customer.status.update', 'customer', params.id,
    `Customer status changed to ${status}`, { status });

  return successResponse({ message: 'Customer status updated' }, 200, event);
};

// ─── GET /api/v1/customers/:id/loans ───

export const handleGetCustomerLoans: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const result = await query(
    `SELECT * FROM loans
     WHERE customer_id = $1
     ORDER BY created_at DESC`,
    [params.id]
  );

  if (result.error) {
    logger.error('Customer loans query failed', {
      action: 'customers.loans',
      status: 'failed',
      errorMessage: result.error.message,
    });
    return errorResponse('Failed to fetch loans', 500, {}, event);
  }

  return successResponse(result.data, 200, event);
};

// ─── GET /api/v1/customers/:id/payments ───

export const handleGetCustomerPayments: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const result = await query(
    `SELECT p.* FROM payments p
     JOIN loans l ON l.id = p.loan_id
     WHERE l.customer_id = $1
     ORDER BY p.payment_date DESC`,
    [params.id]
  );

  if (result.error) {
    logger.error('Customer payments query failed', {
      action: 'customers.payments',
      status: 'failed',
      errorMessage: result.error.message,
    });
    return errorResponse('Failed to fetch payments', 500, {}, event);
  }

  return successResponse(result.data, 200, event);
};

// ─── GET /api/v1/customers/:id/credit-score ───

export const handleGetCustomerCreditScore: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const result = await queryOne(
    `SELECT
      id,
      customer_id,
      total_score,
      scaled_score,
      score_components AS components,
      decision,
      credit_limit_usd AS credit_limit,
      tier,
      calculated_at
    FROM credit_scores
    WHERE customer_id = $1
    ORDER BY calculated_at DESC
    LIMIT 1`,
    [params.id]
  );

  if (!result.data) {
    return successResponse(null, 200, event);
  }

  // Parse components if stored as JSON string
  const data = result.data as Record<string, unknown>;
  if (typeof data.components === 'string') {
    data.components = JSON.parse(data.components as string);
  }

  return successResponse(data, 200, event);
};

// ─── GET /api/v1/customers/:id/credit-score/history ───

export const handleGetCreditScoreHistory: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const result = await query(
    `SELECT
      id,
      customer_id,
      total_score,
      scaled_score,
      score_components AS components,
      decision,
      credit_limit_usd AS credit_limit,
      tier,
      calculated_at
    FROM credit_scores
    WHERE customer_id = $1
    ORDER BY calculated_at DESC`,
    [params.id]
  );

  if (result.error) {
    return errorResponse('Failed to fetch credit score history', 500, {}, event);
  }

  return successResponse(result.data, 200, event);
};

// ─── GET /api/v1/customers/:id/kyc ───

export const handleGetCustomerKYC: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const result = await query(
    `SELECT
      id,
      customer_id,
      id_document_type,
      id_number,
      id_document_url AS document_front_url,
      selfie_url,
      status,
      verification_decision,
      verification_confidence,
      face_match_score,
      liveness_score,
      extracted_name,
      extracted_dob,
      submitted_at,
      submitted_at AS created_at,
      attempt_number
    FROM kyc_submissions
    WHERE customer_id = $1
    ORDER BY submitted_at DESC`,
    [params.id]
  );

  if (result.error) {
    return errorResponse('Failed to fetch KYC submissions', 500, {}, event);
  }

  // Map extracted_name to first/last for frontend
  const data = result.data.map((row: Record<string, unknown>) => {
    const { extracted_name, extracted_dob, ...rest } = row;
    const nameParts = ((extracted_name as string) || '').split(/\s+/);
    return {
      ...rest,
      extracted_first_name: nameParts[0] || null,
      extracted_last_name: nameParts.slice(1).join(' ') || null,
      extracted_date_of_birth: extracted_dob || null,
    };
  });

  return successResponse(data, 200, event);
};

// ─── GET /api/v1/customers/:id/timeline ───

export const handleGetCustomerTimeline: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const result = await query(
    `SELECT
      id,
      action,
      entity_type,
      entity_id,
      details,
      created_at,
      admin_user_id AS admin_id
    FROM audit_log
    WHERE entity_type = 'customer' AND entity_id = $1
    ORDER BY created_at DESC
    LIMIT 50`,
    [params.id]
  );

  if (result.error) {
    return errorResponse('Failed to fetch timeline', 500, {}, event);
  }

  // Parse details if stored as JSON string
  const data = result.data.map((row: Record<string, unknown>) => {
    if (typeof row.details === 'string') {
      row.details = JSON.parse(row.details as string);
    }
    return row;
  });

  return successResponse(data, 200, event);
};

// ─── POST /api/v1/customers/:id/notes ───

export const handleAddCustomerNote: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const { note_type, note_text } = body;

  if (!note_text) {
    return errorResponse('note_text is required', 400, {}, event);
  }

  const now = new Date().toISOString();

  // Insert into audit_log as a note action
  const result = await queryOne<{ id: string }>(
    `INSERT INTO audit_log (admin_user_id, user_type, user_email, action, entity_type, entity_id, description, created_at)
     VALUES ($1, 'admin', $2, 'customer.note.add', 'customer', $3, $4, $5)
     RETURNING id`,
    [auth.userId, auth.email, params.id, note_text, now]
  );

  return successResponse({
    id: result.data?.id,
    customer_id: params.id,
    note_type: note_type || 'general',
    note_text,
    created_by: auth.userId,
    created_at: now,
  }, 201, event);
};
