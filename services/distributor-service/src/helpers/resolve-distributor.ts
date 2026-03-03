import { APIGatewayProxyEvent } from 'aws-lambda';
import { AuthContext, isAdminOrManager } from '../../../shared/middleware/authorization';
import { db } from '../../../shared/clients/database';

/**
 * Resolve the distributor record based on the authenticated user's role.
 *
 * - Users with 'distributor' role: looked up by auth.userId (self-access).
 * - Pure admins (no distributor role): looked up by `distributor_id` query param.
 *   Returns null when no distributor_id is provided (handler returns 404).
 *
 * Dual-role users (e.g. super_admin + distributor) use self-lookup unless
 * they explicitly pass a distributor_id to view another distributor's data.
 */
export async function resolveDistributor(
  auth: AuthContext,
  event: APIGatewayProxyEvent,
  selectColumns = 'id'
): Promise<{ id: string; [key: string]: unknown } | null> {
  const hasDistributorRole = auth.roles.includes('distributor');
  const distributorId = event.queryStringParameters?.distributor_id;

  // Admin explicitly requesting a specific distributor's data
  if (distributorId && isAdminOrManager(auth)) {
    const { data, error } = await db
      .from('distributors')
      .select(selectColumns)
      .eq('id', distributorId)
      .single()
      .execute();
    if (error) {
      throw new Error(`Database error resolving distributor: ${error.message}`);
    }
    return data;
  }

  // User has distributor role — look up their own record
  if (hasDistributorRole) {
    const { data, error } = await db
      .from('distributors')
      .select(selectColumns)
      .eq('user_id', auth.userId)
      .single()
      .execute();
    if (error) {
      throw new Error(`Database error resolving distributor: ${error.message}`);
    }
    return data;
  }

  // Pure admin without distributor role and no distributor_id param
  return null;
}
