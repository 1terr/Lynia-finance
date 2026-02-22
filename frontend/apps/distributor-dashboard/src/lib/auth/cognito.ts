import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const poolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

/**
 * Returns true only when the Cognito env vars contain values that look like
 * real AWS Cognito identifiers (not placeholders or empty strings).
 *
 * Pool ID format: `<region>_<alphanumeric>` e.g. `us-east-1_Ab12Cd34E`
 */
export function isCognitoConfigured(): boolean {
  return /^[\w-]+_[0-9a-zA-Z]+$/.test(poolId) && clientId.length > 10;
}

// Only create the pool when configuration looks valid.
// When env vars are missing or contain placeholders the constructor either
// throws (undefined values) or creates an unusable pool that hangs on
// network requests to non-existent AWS endpoints.
let userPool: CognitoUserPool | null = null;

if (isCognitoConfigured()) {
  try {
    userPool = new CognitoUserPool({
      UserPoolId: poolId,
      ClientId: clientId,
    });
  } catch {
    // Invalid configuration — fall through to demo mode
  }
}

export { userPool, CognitoUser, AuthenticationDetails };
export type { CognitoUserSession };

export function getCurrentUser() {
  if (!userPool) return null;
  return userPool.getCurrentUser();
}

export function getSession(): Promise<CognitoUserSession | null> {
  if (!userPool) return Promise.resolve(null);
  const user = getCurrentUser();
  if (!user) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) reject(err);
      else resolve(session);
    });
  });
}

export function signOut(): void {
  if (!userPool) return;
  const user = getCurrentUser();
  if (user) user.signOut();
}
