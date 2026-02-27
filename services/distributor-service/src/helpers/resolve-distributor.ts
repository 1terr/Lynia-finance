import { APIGatewayProxyEvent } from 'aws-lambda';
import { AuthContext, isAdminOrManager } from '../../../shared/middleware/authorization';
import { db } from '../../../shared/clients/database';

/**
 * Resolve the distributor record based on the authenticated user's role.
 *
 * - Distributors: looked up by auth.userId (self-access).
 * - Admins: looked up by optional `distributor_id` query parameter.
 *   Returns null when no distributor_id is provided (handler returns 404).
 */
export async function resolveDistributor(
  auth: AuthContext,
  event: APIGatewayProxyEvent,
  selectColumns = 'id'
): Promise<{ id: string; [key: string]: unknown } | null> {
  if (isAdminOrManager(auth)) {
    const distributorId = event.queryStringParameters?.distributor_id;
    if (!distributorId) return null;

    const { data } = await db
      .from('distributors')
      .select(selectColumns)
      .eq('id', distributorId)
      .single()
      .execute();
    return data;
  }

  const { data } = await db
    .from('distributors')
    .select(selectColumns)
    .eq('user_id', auth.userId)
    .single()
    .execute();
  return data;
}
