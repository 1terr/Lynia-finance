import type { CognitoUserSession } from './cognito';

// Admin user types - these will be re-exported from each app
export type AdminRole =
  | 'super_admin'
  | 'operations_manager'
  | 'credit_analyst'
  | 'compliance_officer'
  | 'customer_support'
  | 'finance_manager'
  | 'read_only';

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: AdminRole;
  is_active: boolean;
  department: string | null;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
  updated_at: string;
}

const VALID_ADMIN_ROLES: AdminRole[] = [
  'super_admin',
  'operations_manager',
  'credit_analyst',
  'compliance_officer',
  'customer_support',
  'finance_manager',
  'read_only',
];

function isValidAdminRole(role: string): role is AdminRole {
  return VALID_ADMIN_ROLES.includes(role as AdminRole);
}

/**
 * Extract an AdminUser from Cognito JWT claims.
 *
 * The profile is constructed entirely from the ID token payload so
 * no backend API call is required.
 */
export function buildAdminUserFromSession(
  session: CognitoUserSession
): AdminUser | null {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload();

  // Extract role from cognito:groups claim
  const groups: string[] = payload['cognito:groups'] || [];
  const role = groups.find((g) => isValidAdminRole(g)) as AdminRole | undefined;

  if (!role) return null;

  return {
    id: payload.sub as string,
    email: (payload.email as string) || '',
    first_name: (payload.given_name as string) || '',
    last_name: (payload.family_name as string) || '',
    role,
    is_active: true,
    department: (payload['custom:department'] as string) || null,
    last_login_at: null,
    login_count: 0,
    created_at: '',
    updated_at: '',
  };
}
