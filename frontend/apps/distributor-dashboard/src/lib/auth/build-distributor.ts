import type { CognitoUserSession } from '@lynia/auth';
import type { Distributor } from '@/types/distributor';

/**
 * Build a Distributor profile from Cognito JWT claims.
 *
 * Mirrors the admin portal's buildAdminUserFromSession() approach:
 * the profile is constructed entirely from the ID token payload so
 * no backend API call is required.
 */
export function buildDistributorFromSession(
  session: CognitoUserSession,
): Distributor {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload();

  const sub = payload.sub as string;
  const email = (payload.email as string) || '';
  const givenName = (payload.given_name as string) || '';
  const familyName = (payload.family_name as string) || '';
  const displayName = (payload['custom:display_name'] as string) || '';

  const name =
    displayName ||
    (givenName || familyName
      ? `${givenName} ${familyName}`.trim()
      : null) ||
    email.split('@')[0] ||
    'Distributor';

  return {
    id: sub,
    user_id: sub,
    name,
    phone_number: '',
    email,
    national_id: '',
    business_name: '',
    province: '',
    city: '',
    address: '',
    latitude: null,
    longitude: null,
    bank_name: null,
    account_number: null,
    mobile_money_number: null,
    commission_rate: 0,
    total_commissions_earned: 0,
    total_commissions_paid: 0,
    pending_commissions: 0,
    total_loans_disbursed: 0,
    total_devices_distributed: 0,
    current_inventory_count: 0,
    average_rating: 0,
    status: 'active',
    kyc_status: 'pending',
    kyc_verified_at: null,
    onboarded_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}
