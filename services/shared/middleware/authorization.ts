/**
 * Application-Layer Authorization Middleware
 *
 * Replaces Supabase Row Level Security (RLS) policies.
 * Extracts user identity from Cognito JWT claims (set by API Gateway
 * Cognito authorizer) and provides role-based access control.
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

type Role =
  | 'super_admin'
  | 'admin'
  | 'operations_manager'
  | 'customer_support'
  | 'finance_team'
  | 'kyc_reviewer'
  | 'inventory_manager'
  | 'reports_viewer'
  | 'distributor'
  | 'customer'
  | 'investor';

export interface AuthContext {
  userId: string;
  email: string;
  roles: Role[];
}

/**
 * Extract auth context from Cognito-validated API Gateway event.
 *
 * @param event - API Gateway event with Cognito authorizer claims
 * @returns Parsed user identity and roles
 * @throws AUTH_TOKEN_001 if authorizer claims are missing
 */
export function getAuthContext(event: APIGatewayProxyEvent): AuthContext {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) {
    throw createAuthError('AUTH_TOKEN_001', 'Missing authentication');
  }

  return {
    userId: claims.sub,
    email: claims.email,
    roles: parseGroups(claims['cognito:groups']),
  };
}

/**
 * Replaces: is_admin_or_manager() SQL function
 */
export function isAdminOrManager(auth: AuthContext): boolean {
  return auth.roles.some(r => r === 'super_admin' || r === 'admin' || r === 'operations_manager');
}

/**
 * Check whether the user holds any internal staff role.
 *
 * @param auth - Current user's auth context
 * @returns True if the user is any kind of admin, support, or back-office staff
 */
export function isAdminStaff(auth: AuthContext): boolean {
  return auth.roles.some(r =>
    ['super_admin', 'admin', 'operations_manager', 'customer_support', 'finance_team', 'kyc_reviewer', 'inventory_manager', 'reports_viewer'].includes(r)
  );
}

/**
 * Enforce role requirement. Throws 403 if the user lacks all listed roles.
 *
 * @param auth - Current user's auth context
 * @param allowedRoles - Roles that grant access (any one suffices)
 * @throws AUTH_ROLE_001 if the user holds none of the allowed roles
 */
export function requireRole(auth: AuthContext, ...allowedRoles: Role[]): void {
  const hasRole = auth.roles.some(r => allowedRoles.includes(r));
  if (!hasRole) {
    throw createAuthError(
      'AUTH_ROLE_001',
      'Insufficient permissions'
    );
  }
}

/**
 * Enforce resource ownership, with optional admin override.
 *
 * @param auth - Current user's auth context
 * @param resourceOwnerId - UUID of the resource owner
 * @param allowAdminOverride - Allow admins/managers to bypass (default true)
 * @throws AUTH_OWNER_001 if the user is not the owner and not an admin
 */
export function requireOwnership(
  auth: AuthContext,
  resourceOwnerId: string,
  allowAdminOverride = true
): void {
  if (auth.userId === resourceOwnerId) return;
  if (allowAdminOverride && isAdminOrManager(auth)) return;

  throw createAuthError(
    'AUTH_OWNER_001',
    'Access denied: you do not own this resource'
  );
}

/**
 * Build a SQL WHERE clause that scopes query results to the user's access level.
 *
 * @param auth - Current user's auth context
 * @param ownerColumn - Column name to filter on (e.g. 'customer_id')
 * @returns Object with a `clause` string and parameterized `params` array
 */
export function buildAccessFilter(
  auth: AuthContext,
  ownerColumn: string
): { clause: string; params: unknown[] } {
  if (isAdminOrManager(auth)) {
    return { clause: '1=1', params: [] };
  }

  if (isAdminStaff(auth)) {
    return { clause: '1=1', params: [] };
  }

  return {
    clause: `${ownerColumn} = $1`,
    params: [auth.userId],
  };
}

function parseGroups(groups: string | undefined): Role[] {
  if (!groups) return [];
  return groups.split(',').filter(Boolean) as Role[];
}

/**
 * Check if the user has investor role.
 * Investors have read-only access to dw schema data only.
 */
export function isInvestor(auth: AuthContext): boolean {
  return auth.roles.includes('investor');
}

/**
 * Validate API key for machine-to-machine investor access.
 * Used by investor platforms (e.g., Cascade Debt) to pull data
 * without Cognito JWT authentication.
 *
 * The API key is stored in Secrets Manager and passed via
 * x-api-key header.
 */
export function getApiKeyAuth(event: APIGatewayProxyEvent): AuthContext | null {
  const apiKey = event.headers?.['x-api-key'] || event.headers?.['X-Api-Key'];
  if (!apiKey) return null;

  // API key validation happens in the handler after comparing
  // with the secret stored in Secrets Manager.
  // This function returns a placeholder context that the handler
  // replaces after validation.
  return {
    userId: 'api-key-user',
    email: 'api@investor.lyniafinance.com',
    roles: ['investor'],
  };
}

function createAuthError(code: string, message: string) {
  const error = new Error(message);
  (error as unknown as Record<string, unknown>).code = code;
  (error as unknown as Record<string, unknown>).statusCode = 403;
  return error;
}
