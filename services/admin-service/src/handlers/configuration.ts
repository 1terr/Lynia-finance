import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager, AuthContext } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog, COGNITO_ADMIN_ROLES } from './helpers';

// ─── GET /admin/config ───

export const handleGetConfigs: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data, error } = await db.from('system_config')
    .select('*')
    .order('config_key', { ascending: true })
    .execute();

  if (error) {
    logger.error('Error fetching system configs', {
      action: 'admin.configuration.getConfigs',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to fetch configs', 500, {}, event);
  }

  return successResponse(data, 200, event);
};

// ─── PATCH /admin/config/:id ───

export const handleUpdateConfig: RouteHandler = async (event, params, auth) => {
  const configId = params.id;

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
    logger.error('Error updating config', {
      action: 'admin.configuration.updateConfig',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to update config', 500, {}, event);
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return errorResponse('Config not found', 404, {}, event);
  }

  await auditLog(auth, 'update', 'system_config', configId, `Updated system config: ${configId}`);

  return successResponse(row, 200, event);
};
