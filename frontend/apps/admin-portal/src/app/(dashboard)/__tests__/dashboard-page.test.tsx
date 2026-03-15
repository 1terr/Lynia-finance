import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { renderWithProviders } from '@/test/helpers';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'a1', full_name: 'Admin', email: 'a@b.com', role: 'super_admin' },
    isLoading: false,
  }),
}));
jest.mock('@/lib/hooks/use-dashboard-data', () => ({
  useDashboardMetrics: () => ({ data: null, isLoading: true, dataUpdatedAt: 0 }),
  usePortfolioAtRisk: () => ({ data: null }),
  useDailyTrends: () => ({ data: null }),
  useLoansByStatus: () => ({ data: null }),
  useRecentActivity: () => ({ data: null }),
  useCoreBankingHealth: () => ({ data: null }),
}));
jest.mock('@lynia/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  formatCurrency: (n: number) => `$${n}`,
  formatNumber: (n: number) => String(n),
  formatPercent: (n: number) => `${n}%`,
  formatRelativeTime: () => '2h ago',
}));

import DashboardPage from '../_client';

describe('Dashboard Page', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<DashboardPage />);
    expect(container).toBeTruthy();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = renderWithProviders(<DashboardPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
