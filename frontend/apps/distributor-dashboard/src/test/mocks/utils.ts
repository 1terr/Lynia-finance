import { isCognitoConfigured } from '@lynia/auth';

/**
 * Simulates network delay for mock API responses
 */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Determines whether to use mock data (when Cognito is not configured)
 * or real API calls (when Cognito is properly configured).
 *
 * In production, mocks are NEVER used regardless of Cognito configuration
 * to prevent fake data from leaking to real users.
 */
export function useMock(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return !isCognitoConfigured();
}
