import { getValidSession, signOut as cognitoSignOut } from '@lynia/auth';
import type { AdminUser, DashboardMetrics, PortfolioAtRisk, DailyTrend, LoansByStatus, RecentActivity } from '@/types';
import type { ReconciliationResult, CoreBankingHealthResult } from '@/types/fineract';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

/**
 * Authenticated API client using Cognito JWT tokens.
 *
 * Uses getValidSession() which auto-refreshes expired tokens before
 * returning. On 401 responses, clears the session and redirects to login.
 */
export async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const session = await getValidSession();

  if (!session) {
    handleSessionExpired();
    throw new Error('Authentication required. Please sign in.');
  }

  const token = session.getIdToken().getJwtToken();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Endpoint request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  // Handle Cognito token rejection from backend
  if (res.status === 401) {
    handleSessionExpired();
    throw new Error('Session expired. Redirecting to login.');
  }

  if (res.status === 403) {
    throw new Error('You do not have permission to perform this action.');
  }

  if (!res.ok) {
    // Parse error response body for detailed error message
    const errorMessage = await parseErrorResponse(res);
    throw new Error(errorMessage);
  }

  const json = await res.json();

  // Unwrap { success, data } envelope if present
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

/** Extract a user-friendly error message from the API response body. */
async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const body = await res.json();
    // Backend returns { success: false, error: "message" } or { error: { message: "..." } }
    if (typeof body?.error === 'string') return body.error;
    if (typeof body?.error?.message === 'string') return body.error.message;
    if (typeof body?.message === 'string') return body.message;
  } catch {
    // Response body was not JSON
  }
  return `Request failed (${res.status})`;
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

export async function getDashboardMetrics(dateFrom?: string, dateTo?: string): Promise<DashboardMetrics> {
  const params = new URLSearchParams();
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  const qs = params.toString();
  return fetchAPI<DashboardMetrics>(`/api/v1/dashboard/metrics${qs ? `?${qs}` : ''}`);
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

export async function getCoreBankingHealth(): Promise<CoreBankingHealthResult> {
  return fetchAPI<CoreBankingHealthResult>('/api/v1/fineract/system-health');
}
