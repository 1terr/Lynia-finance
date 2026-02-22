import { isCognitoConfigured } from '@lynia/auth';

/**
 * Simulates network delay for mock API responses
 */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Determines whether to use mock data (when Cognito is not configured)
 * or real API calls (when Cognito is properly configured)
 */
export function useMock(): boolean {
  return !isCognitoConfigured();
}
