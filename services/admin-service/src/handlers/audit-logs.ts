import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager, AuthContext } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';

// ─── GET /admin/audit-logs ───

export const handleGetAuditLogs: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
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
    logger.error('Error fetching audit logs', {
      action: 'admin.auditLogs.getAuditLogs',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to fetch audit logs', 500, {}, event);
  }

  return successResponse({
    data: rows,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  }, 200, event);
};
