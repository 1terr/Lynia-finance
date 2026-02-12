import { getSession } from '@/lib/auth/cognito';
import type { AdminUser, DashboardMetrics, PortfolioAtRisk, DailyTrend, LoansByStatus, RecentActivity } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const session = await getSession();

  if (!session) {
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

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

// --- Admin User ---

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  try {
    return await fetchAPI<AdminUser>('/api/v1/admin/me');
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
