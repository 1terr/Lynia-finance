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

/**
 * Returns a valid session, auto-refreshing if the current token is expired
 * or will expire within 60 seconds. Returns null if no user or refresh fails.
 */
export async function getValidSession(): Promise<CognitoUserSession | null> {
  if (!userPool) return null;
  const user = getCurrentUser();
  if (!user) return null;

  const session = await getSession();
  if (!session) return null;

  // Check if the ID token expires within 60 seconds
  const expiresAt = session.getIdToken().getExpiration() * 1000;
  const bufferMs = 60_000;

  if (Date.now() + bufferMs < expiresAt) {
    return session; // Still valid
  }

  // Token is expired or about to expire — refresh it
  const refreshToken = session.getRefreshToken();
  return new Promise((resolve) => {
    user.refreshSession(refreshToken, (err: Error | null, refreshed: CognitoUserSession | null) => {
      if (err || !refreshed) {
        resolve(null); // Refresh failed — caller should redirect to login
      } else {
        resolve(refreshed);
      }
    });
  });
}

export function signOut(): void {
  if (!userPool) return;
  const user = getCurrentUser();
  if (user) user.signOut();
}

/** Initiate forgot-password flow — Cognito sends a verification code to the user's email. */
export function forgotPassword(email: string): Promise<void> {
  if (!userPool) return Promise.reject(new Error('Cognito is not configured'));

  const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

  return new Promise((resolve, reject) => {
    cognitoUser.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err: Error) => reject(err),
      inputVerificationCode: () => resolve(),
    });
  });
}

/** Complete forgot-password flow — verify the code and set the new password. */
export function confirmForgotPassword(
  email: string,
  verificationCode: string,
  newPassword: string
): Promise<void> {
  if (!userPool) return Promise.reject(new Error('Cognito is not configured'));

  const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

  return new Promise((resolve, reject) => {
    cognitoUser.confirmPassword(verificationCode, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err: Error) => reject(err),
    });
  });
}

/** Change password for the currently authenticated user. */
export function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  if (!userPool) return Promise.reject(new Error('Cognito is not configured'));

  const user = getCurrentUser();
  if (!user) return Promise.reject(new Error('No authenticated user'));

  return new Promise((resolve, reject) => {
    // getSession is required to refresh auth state before changePassword
    user.getSession((sessionErr: Error | null) => {
      if (sessionErr) {
        reject(sessionErr);
        return;
      }
      user.changePassword(oldPassword, newPassword, (err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}
