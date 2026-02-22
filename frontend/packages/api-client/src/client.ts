import { getSession } from '@lynia/auth';

/**
 * Authenticated API client using Cognito JWT tokens.
 *
 * Extracts the ID token from the current Cognito session and attaches it
 * as a Bearer token to every request. On 401 responses (expired/invalid
 * token), clears the local Cognito session and redirects to login.
 */
export async function fetchAPI<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const session = await getSession();

  if (!session) {
    handleSessionExpired();
    throw new Error('Authentication required. Please sign in.');
  }

  const token = session.getIdToken().getJwtToken();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  // Handle Cognito token rejection from backend
  if (res.status === 401) {
    handleSessionExpired();
    throw new Error('Session expired. Redirecting to login.');
  }

  if (res.status === 403) {
    throw new Error('You do not have permission to perform this action.');
  }

  if (!res.ok) {
    // Try to extract error message from response body
    const body = await res.json().catch(() => ({}));
    const message = body?.error || `API error: ${res.status}`;
    throw new Error(message);
  }

  const json = await res.json();

  // Unwrap { success, data } envelope or { data } envelope if present
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }

  return json as T;
}

/**
 * Clear Cognito session and redirect to login on auth failure.
 * This is called automatically by fetchAPI on 401 responses.
 */
function handleSessionExpired(): void {
  if (typeof window !== 'undefined') {
    // Clear auth cookie
    document.cookie =
      'lynia-auth-active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

    // Redirect to login
    window.location.href = '/login';
  }
}
