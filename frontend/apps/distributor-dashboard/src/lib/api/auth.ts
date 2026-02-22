import type { Distributor } from '@/types/distributor';
import {
  CognitoUser,
  AuthenticationDetails,
  userPool,
  isCognitoConfigured,
  buildDistributorFromSession,
} from '@lynia/auth';
import { delay } from '@/test/mocks/utils';
import { mockDistributor } from '@/test/mocks/distributor';

export { isCognitoConfigured };

/**
 * Authenticate distributor with email and password
 * Returns distributor profile on successful login
 */
export async function loginDistributor(email: string, password: string): Promise<Distributor> {
  if (!isCognitoConfigured()) {
    // Mock fallback for development / demo mode without Cognito
    await delay(800);
    if (email === 'kudzai@distributor.co.zw' && password.length >= 4) {
      return { ...mockDistributor, email };
    }
    throw new Error('Invalid credentials');
  }

  return new Promise<Distributor>((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool!,
    });

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        const profile = buildDistributorFromSession(session);
        resolve(profile);
      },
      onFailure: () => {
        reject(new Error('Invalid email or password'));
      },
    });
  });
}
