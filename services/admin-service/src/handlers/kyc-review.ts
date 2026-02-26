import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';

// ─── GET /api/v1/kyc/submissions/pending ───

export const handleGetKYCPending: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const params = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(params.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || '25')));
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM kyc_submissions WHERE status IN ('pending', 'manual_review')"
  );
  const total = parseInt(countResult.data?.count || '0');

  const result = await query(
    `SELECT
      ks.id,
      ks.customer_id,
      ks.id_document_type AS document_type,
      ks.id_number AS document_number,
      ks.id_document_url AS document_front_url,
      NULL AS document_back_url,
      ks.selfie_url,
      ks.provider_job_id AS smile_job_id,
      ks.provider_response AS smile_result,
      ks.verification_confidence AS smile_confidence_score,
      ks.status,
      ks.verified_at,
      ks.reviewed_by AS verified_by,
      ks.rejection_reason,
      ks.manual_review_notes,
      ks.liveness_passed,
      ks.liveness_score,
      ks.face_match_score,
      ks.confidence_score AS image_quality_score,
      ks.attempt_number,
      ks.submitted_at,
      ks.extracted_name,
      ks.extracted_dob,
      ks.smile_identity_response AS smile_identity_result,
      ks.submitted_at AS created_at,
      ks.submitted_at AS updated_at,
      c.id AS customer__id,
      c.full_name AS customer__full_name,
      c.phone_number AS customer__phone_number
    FROM kyc_submissions ks
    JOIN customers c ON c.id = ks.customer_id
    WHERE ks.status IN ('pending', 'manual_review')
    ORDER BY ks.submitted_at ASC
    LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  if (result.error) {
    logger.error('KYC pending query failed', {
      action: 'kyc.submissions.pending',
      status: 'failed',
      errorMessage: result.error.message,
    });
    return errorResponse('Failed to fetch pending submissions', 500, {}, event);
  }

  const data = result.data.map((row: Record<string, unknown>) => {
    const { customer__id, customer__full_name, customer__phone_number, extracted_name, extracted_dob, ...rest } = row;
    const nameParts = ((extracted_name as string) || '').split(/\s+/);
    return {
      ...rest,
      extracted_first_name: nameParts[0] || null,
      extracted_last_name: nameParts.slice(1).join(' ') || null,
      extracted_date_of_birth: extracted_dob || null,
      customer: {
        id: customer__id,
        full_name: customer__full_name,
        phone_number: customer__phone_number,
      },
    };
  });

  return successResponse({
    data,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  }, 200, event);
};

/**
 * GET /api/v1/kyc/submissions/review-history
 * List recently reviewed KYC submissions
 */
export const handleGetKYCReviewHistory: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const params = event.queryStringParameters || {};
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || '50')));

  const countResult = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM kyc_submissions WHERE status IN ('verified', 'rejected')"
  );
  const total = parseInt(countResult.data?.count || '0');

  const result = await query(
    `SELECT
      ks.id,
      ks.customer_id,
      ks.status,
      ks.submitted_at AS created_at,
      COALESCE(ks.verified_at, ks.rejected_at, ks.submitted_at) AS updated_at,
      c.full_name AS customer__full_name,
      c.phone_number AS customer__phone_number
    FROM kyc_submissions ks
    JOIN customers c ON c.id = ks.customer_id
    WHERE ks.status IN ('verified', 'rejected')
    ORDER BY COALESCE(ks.verified_at, ks.rejected_at, ks.submitted_at) DESC
    LIMIT $1`,
    [limit]
  );

  if (result.error) {
    logger.error('KYC review history query failed', {
      action: 'kyc.submissions.reviewHistory',
      status: 'failed',
      errorMessage: result.error.message,
    });
    return errorResponse('Failed to fetch review history', 500, {}, event);
  }

  const data = result.data.map((row: Record<string, unknown>) => {
    const { customer__full_name, customer__phone_number, ...rest } = row;
    return {
      ...rest,
      customer: {
        full_name: customer__full_name,
        phone_number: customer__phone_number,
      },
    };
  });

  return successResponse({ data, total }, 200, event);
};

/**
 * GET /api/v1/kyc/submissions/sla-stats
 * SLA statistics for pending KYC submissions
 */
export const handleGetKYCSLAStats: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const result = await queryOne<{
    total: string;
    within4h: string;
    within24h: string;
    over24h: string;
  }>(
    `SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE submitted_at > NOW() - INTERVAL '4 hours') AS within4h,
      COUNT(*) FILTER (WHERE submitted_at <= NOW() - INTERVAL '4 hours' AND submitted_at > NOW() - INTERVAL '24 hours') AS within24h,
      COUNT(*) FILTER (WHERE submitted_at <= NOW() - INTERVAL '24 hours') AS over24h
    FROM kyc_submissions
    WHERE status IN ('pending', 'manual_review')`
  );

  return successResponse({
    total: parseInt(result.data?.total || '0'),
    within4h: parseInt(result.data?.within4h || '0'),
    within24h: parseInt(result.data?.within24h || '0'),
    over24h: parseInt(result.data?.over24h || '0'),
  }, 200, event);
};

/**
 * POST /api/v1/kyc/submissions/{id}/approve
 * Approve a KYC submission
 */
export const handleApproveKYC: RouteHandler = async (event, params, auth) => {
  const submissionId = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const { customer_id, admin_id } = body;

  if (!customer_id) {
    return errorResponse('customer_id is required', 400, {}, event);
  }

  // Update kyc_submissions
  const now = new Date().toISOString();
  await query(
    `UPDATE kyc_submissions
     SET status = 'verified',
         verified_at = $1,
         reviewed_at = $1,
         reviewed_by = $2,
         verification_decision = 'APPROVED'
     WHERE id = $3 AND status IN ('pending', 'manual_review')`,
    [now, admin_id || auth.userId, submissionId]
  );

  // Update customer kyc_status
  await query(
    `UPDATE customers
     SET kyc_status = 'verified',
         kyc_verified_at = $1
     WHERE id = $2`,
    [now, customer_id]
  );

  // Audit log
  await query(
    `INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id, details, created_at)
     VALUES ($1, 'kyc.approve', 'kyc_submission', $2, $3, $4)`,
    [admin_id || auth.userId, submissionId, JSON.stringify({ customer_id }), now]
  );

  return successResponse({ message: 'KYC approved' }, 200, event);
};

/**
 * POST /api/v1/kyc/submissions/{id}/reject
 * Reject a KYC submission
 */
export const handleRejectKYC: RouteHandler = async (event, params, auth) => {
  const submissionId = params.id;

  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const { customer_id, admin_id, reason } = body;

  if (!customer_id) {
    return errorResponse('customer_id is required', 400, {}, event);
  }
  if (!reason) {
    return errorResponse('reason is required', 400, {}, event);
  }

  const now = new Date().toISOString();
  await query(
    `UPDATE kyc_submissions
     SET status = 'rejected',
         rejected_at = $1,
         reviewed_at = $1,
         reviewed_by = $2,
         rejection_reason = $3,
         verification_decision = 'REJECTED'
     WHERE id = $4 AND status IN ('pending', 'manual_review')`,
    [now, admin_id || auth.userId, reason, submissionId]
  );

  // Audit log
  await query(
    `INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id, details, created_at)
     VALUES ($1, 'kyc.reject', 'kyc_submission', $2, $3, $4)`,
    [admin_id || auth.userId, submissionId, JSON.stringify({ customer_id, reason }), now]
  );

  return successResponse({ message: 'KYC rejected' }, 200, event);
};
