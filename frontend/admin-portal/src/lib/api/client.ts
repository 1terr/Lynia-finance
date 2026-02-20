import { getSession, signOut as cognitoSignOut } from '@/lib/auth/cognito';
import type { AdminUser, DashboardMetrics, PortfolioAtRisk, DailyTrend, LoansByStatus, RecentActivity } from '@/types';
import type { ReconciliationResult } from '@/types/fineract';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

/**
 * Authenticated API client using Cognito JWT tokens.
 *
 * Extracts the ID token from the current Cognito session and attaches it
 * as a Bearer token to every request. On 401 responses (expired/invalid
 * token), clears the local Cognito session and redirects to login.
 */
export async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const session = await getSession();

  if (!session) {
    handleSessionExpired();
    throw new Error('Authentication required. Please sign in.');
  }

  const token = session.getIdToken().getJwtToken();

  const res = await fetch(`${API_BASE}${path}`, {
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
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();

  // Unwrap { success, data } envelope if present
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

/** Clear Cognito session and redirect to login on auth failure. */
function handleSessionExpired(): void {
  cognitoSignOut();
  document.cookie = 'lynia-auth-active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

// --- Admin User ---

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  try {
    return await fetchAPI<AdminUser>('/admin/me');
  } catch {
    return null;
  }
}

// --- Dashboard ---

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return fetchAPI<DashboardMetrics>('/api/v1/dashboard/metrics');
}

export async function getPortfolioAtRisk(): Promise<PortfolioAtRisk> {
  return fetchAPI<PortfolioAtRisk>('/api/v1/dashboard/portfolio-at-risk');
}

export async function getDailyTrends(days: number = 30): Promise<DailyTrend[]> {
  days = Math.min(Math.max(days, 1), 365);
  return fetchAPI<DailyTrend[]>(`/api/v1/dashboard/daily-trends?days=${days}`);
}

export async function getLoansByStatus(): Promise<LoansByStatus[]> {
  return fetchAPI<LoansByStatus[]>('/api/v1/dashboard/loans-by-status');
}

export async function getRecentActivity(limit: number = 20): Promise<RecentActivity[]> {
  limit = Math.min(Math.max(limit, 1), 100);
  return fetchAPI<RecentActivity[]>(`/api/v1/dashboard/recent-activity?limit=${limit}`);
}

// --- Fineract Health ---

export async function getFineractReconciliation(): Promise<ReconciliationResult> {
  return fetchAPI<ReconciliationResult>('/api/v1/fineract/reconciliation');
}
