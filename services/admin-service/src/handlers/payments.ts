/**
 * Payment Admin Handlers
 *
 * Admin portal endpoints for viewing, managing, and reconciling payments.
 * These are ADMIN operations — the customer-facing payment-service handles
 * initiation and provider webhooks separately.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse, notFoundResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';

// ─── GET /api/v1/payments ───

export const handleGetPayments: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const page = Math.max(1, parseInt(qs.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.status) {
      conditions.push(`p.status = $${paramIdx++}`);
      values.push(qs.status);
    }

    if (qs.method) {
      conditions.push(`p.payment_method = $${paramIdx++}`);
      values.push(qs.method);
    }

    if (qs.type) {
      conditions.push(`p.payment_type = $${paramIdx++}`);
      values.push(qs.type);
    }

    if (qs.date_from) {
      conditions.push(`p.payment_date >= $${paramIdx++}`);
      values.push(qs.date_from);
    }

    if (qs.date_to) {
      conditions.push(`p.payment_date <= $${paramIdx++}`);
      values.push(qs.date_to);
    }

    if (qs.reconciled !== undefined) {
      conditions.push(`p.reconciled = $${paramIdx++}`);
      values.push(qs.reconciled === 'true');
    }

    if (qs.search) {
      const normalized = qs.search.replace(/[-\s]/g, '');
      const term = `%${qs.search}%`;
      const normalizedTerm = `%${normalized}%`;
      conditions.push(
        `(c.first_name ILIKE $${paramIdx} OR c.last_name ILIKE $${paramIdx} OR c.phone_number ILIKE $${paramIdx} OR p.reference_number ILIKE $${paramIdx} OR p.transaction_id ILIKE $${paramIdx} OR REPLACE(REPLACE(c.national_id, '-', ''), ' ', '') ILIKE $${paramIdx + 1})`
      );
      paramIdx += 2;
      values.push(term, normalizedTerm);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM payments p LEFT JOIN customers c ON c.id = p.customer_id ${whereClause}`,
      values
    );
    const total = parseInt(countResult.data?.count || '0');

    const result = await query(
      `SELECT
        p.id, p.loan_id, p.customer_id, p.payment_type, p.amount_usd, p.currency,
        p.payment_method, p.payment_provider, p.transaction_id, p.reference_number,
        p.status, p.confirmed_at, p.failed_at, p.failure_reason,
        p.reconciled, p.reconciled_at, p.reconciled_by,
        p.payment_date, p.created_at, p.updated_at,
        json_build_object(
          'id', c.id,
          'first_name', c.first_name,
          'last_name', c.last_name,
          'phone_number', c.phone_number
        ) AS customers,
        json_build_object(
          'id', l.id,
          'principal', l.loan_amount_usd,
          'status', l.status
        ) AS loans
      FROM payments p
      LEFT JOIN customers c ON c.id = p.customer_id
      LEFT JOIN loans l ON l.id = p.loan_id
      ${whereClause}
      ORDER BY p.payment_date DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...values, limit, offset]
    );

    return successResponse({
      data: result.data,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch payments', {
      action: 'payment.list', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};

// ─── GET /api/v1/payments/stats ───

export const handleGetPaymentStats: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const result = await queryOne<{
      total_payments: string;
      total_collected: string;
      pending_count: string;
      failed_count: string;
      unreconciled_count: string;
    }>(`SELECT
      COUNT(*) AS total_payments,
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN amount_usd ELSE 0 END), 0) AS total_collected,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
      COUNT(*) FILTER (WHERE reconciled = false AND status = 'confirmed') AS unreconciled_count
    FROM payments`);

    return successResponse({
      total_payments: parseInt(result.data?.total_payments || '0'),
      total_collected: parseFloat(result.data?.total_collected || '0'),
      pending_count: parseInt(result.data?.pending_count || '0'),
      failed_count: parseInt(result.data?.failed_count || '0'),
      unreconciled_count: parseInt(result.data?.unreconciled_count || '0'),
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch payment stats', {
      action: 'payment.stats', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};

// ─── GET /api/v1/payments/unreconciled ───

export const handleGetUnreconciledPayments: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const result = await query(
      `SELECT
        p.id, p.loan_id, p.customer_id, p.payment_type, p.amount_usd, p.currency,
        p.payment_method, p.payment_provider, p.transaction_id, p.reference_number,
        p.status, p.confirmed_at, p.failed_at, p.failure_reason,
        p.reconciled, p.reconciled_at, p.reconciled_by,
        p.payment_date, p.created_at, p.updated_at,
        json_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name, 'phone_number', c.phone_number) AS customers,
        json_build_object('id', l.id, 'principal', l.loan_amount_usd, 'status', l.status) AS loans
      FROM payments p
      LEFT JOIN customers c ON c.id = p.customer_id
      LEFT JOIN loans l ON l.id = p.loan_id
      WHERE p.reconciled = false AND p.status = 'confirmed'
      ORDER BY p.payment_date DESC
      LIMIT 200`
    );

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to fetch unreconciled payments', {
      action: 'payment.unreconciled', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};

// ─── GET /api/v1/payments/overdue-collections ───

export const handleGetOverdueCollections: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const result = await query(
      `SELECT
        l.id, l.id AS loan_id, l.customer_id,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        c.phone_number AS customer_phone,
        l.next_payment_amount_usd AS amount_due,
        l.days_past_due AS days_overdue,
        l.missed_payments_count AS missed_payments,
        l.last_payment_date,
        l.next_payment_date,
        CASE
          WHEN l.days_past_due > 90 THEN 'critical'
          WHEN l.days_past_due > 60 THEN 'high'
          WHEN l.days_past_due > 30 THEN 'medium'
          ELSE 'low'
        END AS priority
      FROM loans l
      JOIN customers c ON c.id = l.customer_id
      WHERE l.days_past_due > 0
        AND l.status IN ('active', 'disbursed')
        AND l.deleted_at IS NULL
      ORDER BY l.days_past_due DESC
      LIMIT 200`
    );

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to fetch overdue collections', {
      action: 'payment.overdue-collections', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};

// ─── GET /api/v1/payments/summary ───

export const handleGetPaymentSummary: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.date_from) {
      conditions.push(`payment_date >= $${paramIdx++}`);
      values.push(qs.date_from);
    }
    if (qs.date_to) {
      conditions.push(`payment_date <= $${paramIdx++}`);
      values.push(qs.date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await queryOne<{
      total_confirmed: string;
      total_pending: string;
      total_failed: string;
      total_refunded: string;
      count_confirmed: string;
      count_pending: string;
      count_failed: string;
      count_refunded: string;
    }>(`SELECT
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN amount_usd ELSE 0 END), 0) AS total_confirmed,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_usd ELSE 0 END), 0) AS total_pending,
      COALESCE(SUM(CASE WHEN status = 'failed' THEN amount_usd ELSE 0 END), 0) AS total_failed,
      COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount_usd ELSE 0 END), 0) AS total_refunded,
      COUNT(*) FILTER (WHERE status = 'confirmed') AS count_confirmed,
      COUNT(*) FILTER (WHERE status = 'pending') AS count_pending,
      COUNT(*) FILTER (WHERE status = 'failed') AS count_failed,
      COUNT(*) FILTER (WHERE status = 'refunded') AS count_refunded
    FROM payments ${whereClause}`, values);

    return successResponse({
      total_confirmed: parseFloat(result.data?.total_confirmed || '0'),
      total_pending: parseFloat(result.data?.total_pending || '0'),
      total_failed: parseFloat(result.data?.total_failed || '0'),
      total_refunded: parseFloat(result.data?.total_refunded || '0'),
      count_confirmed: parseInt(result.data?.count_confirmed || '0'),
      count_pending: parseInt(result.data?.count_pending || '0'),
      count_failed: parseInt(result.data?.count_failed || '0'),
      count_refunded: parseInt(result.data?.count_refunded || '0'),
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch payment summary', {
      action: 'payment.summary', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};

// ─── POST /api/v1/payments/manual ───

export const handleRecordManualPayment: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { loan_id, customer_id, amount_usd, payment_method, payment_type, reference_number, payment_date, notes } = body;

    if (!loan_id || !customer_id || !amount_usd || !payment_method || !payment_type) {
      return errorResponse('Missing required fields: loan_id, customer_id, amount_usd, payment_method, payment_type', 400, { requestId: event.requestContext?.requestId }, event);
    }

    if (typeof amount_usd !== 'number' || amount_usd <= 0) {
      return errorResponse('amount_usd must be a positive number', 400, { requestId: event.requestContext?.requestId }, event);
    }

    const result = await queryOne(
      `INSERT INTO payments (
        loan_id, customer_id, amount_usd, payment_method, payment_type,
        reference_number, payment_date, status, confirmed_at,
        manual_verification_by, manual_verification_at, manual_verification_notes,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', NOW(), $8, NOW(), $9, NOW(), NOW())
      RETURNING *`,
      [loan_id, customer_id, amount_usd, payment_method, payment_type,
       reference_number || null, payment_date || new Date().toISOString(),
       auth.userId, notes || null]
    );

    await auditLog(auth, 'payment.manual_record', 'payment', result.data?.id as string,
      `Manually recorded ${payment_method} payment of $${amount_usd}`,
      { loan_id, amount_usd, payment_method });

    return successResponse(result.data, 201, event);
  } catch (error) {
    logger.error('Failed to record manual payment', {
      action: 'payment.manual', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};

// ─── GET /api/v1/payments/:id ───

export const handleGetPaymentById: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const result = await queryOne(
      `SELECT
        p.*,
        json_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name, 'phone_number', c.phone_number) AS customers,
        json_build_object('id', l.id, 'principal', l.loan_amount_usd, 'status', l.status) AS loans
      FROM payments p
      LEFT JOIN customers c ON c.id = p.customer_id
      LEFT JOIN loans l ON l.id = p.loan_id
      WHERE p.id = $1`,
      [params.id]
    );

    if (!result.data) {
      return notFoundResponse('Payment', event);
    }

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to fetch payment', {
      action: 'payment.get', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};

// ─── POST /api/v1/payments/:id/confirm ───

export const handleConfirmPayment: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const existing = await queryOne<{ status: string; payment_type: string; loan_id: string }>(
      'SELECT status, payment_type, loan_id FROM payments WHERE id = $1', [params.id]
    );
    if (!existing.data) return notFoundResponse('Payment', event);
    if (existing.data.status !== 'pending') {
      return errorResponse(
        `Payment cannot be confirmed — current status is '${existing.data.status}'`,
        409,
        { requestId: event.requestContext?.requestId },
        event,
      );
    }

    const result = await queryOne(
      `UPDATE payments SET status = 'confirmed', confirmed_at = NOW(),
       manual_verification_by = $2, manual_verification_at = NOW(),
       manual_verification_notes = $3, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [params.id, auth.userId, body.notes || null]
    );

    // When a deposit payment is confirmed, update the loan status to 'paid_deposit'
    // so it becomes eligible for handover
    if (existing.data.payment_type === 'deposit' && existing.data.loan_id) {
      await query(
        `UPDATE loans SET status = 'paid_deposit', updated_at = NOW()
         WHERE id = $1 AND status = 'approved'`,
        [existing.data.loan_id]
      );
    }

    await auditLog(auth, 'payment.confirm', 'payment', params.id,
      'Manually confirmed payment', { notes: body.notes, paymentType: existing.data.payment_type });

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to confirm payment', {
      action: 'payment.confirm', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};

// ─── POST /api/v1/payments/:id/fail ───

export const handleFailPayment: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const existing = await queryOne<{ status: string }>(
      'SELECT status FROM payments WHERE id = $1', [params.id]
    );
    if (!existing.data) return notFoundResponse('Payment', event);

    const result = await queryOne(
      `UPDATE payments SET status = 'failed', failed_at = NOW(),
       failure_reason = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [params.id, body.notes || 'Marked as failed by admin']
    );

    await auditLog(auth, 'payment.fail', 'payment', params.id,
      'Marked payment as failed', { notes: body.notes });

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to mark payment as failed', {
      action: 'payment.fail', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};

// ─── POST /api/v1/payments/:id/retry ───

export const handleRetryPayment: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const existing = await queryOne<{ status: string }>(
      'SELECT status FROM payments WHERE id = $1', [params.id]
    );
    if (!existing.data) return notFoundResponse('Payment', event);

    const result = await queryOne(
      `UPDATE payments SET status = 'pending', failed_at = NULL,
       failure_reason = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [params.id]
    );

    await auditLog(auth, 'payment.retry', 'payment', params.id,
      'Retried failed payment');

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to retry payment', {
      action: 'payment.retry', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};

// ─── POST /api/v1/payments/:id/refund ───

export const handleRefundPayment: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const existing = await queryOne<{ status: string }>(
      'SELECT status FROM payments WHERE id = $1', [params.id]
    );
    if (!existing.data) return notFoundResponse('Payment', event);
    if (existing.data.status === 'refunded') {
      return errorResponse('Payment is already refunded', 409, { requestId: event.requestContext?.requestId }, event);
    }

    const result = await queryOne(
      `UPDATE payments SET status = 'refunded', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [params.id]
    );

    await auditLog(auth, 'payment.refund', 'payment', params.id,
      'Refunded payment', { notes: body.notes });

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to refund payment', {
      action: 'payment.refund', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};

// ─── POST /api/v1/payments/:id/reconcile ───

export const handleReconcilePayment: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const existing = await queryOne<{ status: string; reconciled: boolean }>(
      'SELECT status, reconciled FROM payments WHERE id = $1', [params.id]
    );
    if (!existing.data) return notFoundResponse('Payment', event);

    const result = await queryOne(
      `UPDATE payments SET reconciled = true, reconciled_at = NOW(),
       reconciled_by = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [params.id, auth.userId]
    );

    await auditLog(auth, 'payment.reconcile', 'payment', params.id,
      'Reconciled payment');

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to reconcile payment', {
      action: 'payment.reconcile', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, { requestId: event.requestContext?.requestId }, event);
  }
};
