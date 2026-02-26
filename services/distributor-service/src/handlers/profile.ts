import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db } from '../../../shared/clients/database';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  parseBody,
} from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';

/**
 * GET /api/v1/distributor/profile
 */
export const handleGetProfile: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor');

  const { data: distributor, error } = await db
    .from('distributors')
    .select('*')
    .eq('user_id', auth.userId)
    .single()
    .execute();

  if (error || !distributor) {
    return notFoundResponse('Distributor profile', event);
  }

  return successResponse(distributor, 200, event);
};

/**
 * PATCH /api/v1/distributor/profile
 */
export const handleUpdateProfile: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor');

  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  const allowedFields = [
    'phone_number', 'email', 'address', 'city', 'province',
    'bank_name', 'account_number', 'mobile_money_number',
    'latitude', 'longitude',
  ];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body && field in (body as Record<string, unknown>)) {
      updates[field] = (body as Record<string, unknown>)[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse('No valid fields to update', 400, undefined, event);
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await db
    .from('distributors')
    .update(updates)
    .eq('user_id', auth.userId)
    .select()
    .single()
    .execute();

  if (error || !updated) {
    return errorResponse('Failed to update profile', 500, undefined, event);
  }

  return successResponse(updated, 200, event);
};
