import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the API client functions
jest.mock('@/lib/api/client', () => ({
  getDashboardMetrics: jest.fn(),
  getPortfolioAtRisk: jest.fn(),
  getDailyTrends: jest.fn(),
  getLoansByStatus: jest.fn(),
  getRecentActivity: jest.fn(),
  getFineractReconciliation: jest.fn(),
  getCoreBankingHealth: jest.fn(),
}));

import {
  getDashboardMetrics,
  getPortfolioAtRisk,
  getDailyTrends,
  getLoansByStatus,
  getRecentActivity,
  getFineractReconciliation,
  getCoreBankingHealth,
} from '@/lib/api/client';
import {
  useDashboardMetrics,
  usePortfolioAtRisk,
  useDailyTrends,
  useLoansByStatus,
  useRecentActivity,
  useFineractHealth,
  useCoreBankingHealth,
} from '@/lib/hooks/use-dashboard-data';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useDashboardMetrics', () => {
  it('calls getDashboardMetrics and returns data', async () => {
    const mockData = { totalCustomers: 150, activeLoans: 45 };
    (getDashboardMetrics as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboardMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(getDashboardMetrics).toHaveBeenCalledTimes(1);
  });

  it('handles error state', async () => {
    (getDashboardMetrics as jest.Mock).mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useDashboardMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});

describe('usePortfolioAtRisk', () => {
  it('calls getPortfolioAtRisk and returns data', async () => {
    const mockData = { par30: 5.2, par60: 2.1, par90: 0.8 };
    (getPortfolioAtRisk as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => usePortfolioAtRisk(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });
});

describe('useDailyTrends', () => {
  it('calls getDailyTrends with default 30 days', async () => {
    const mockData = [{ date: '2026-03-01', count: 10 }];
    (getDailyTrends as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => useDailyTrends(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getDailyTrends).toHaveBeenCalledWith(30);
    expect(result.current.data).toEqual(mockData);
  });

  it('calls getDailyTrends with custom days', async () => {
    (getDailyTrends as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useDailyTrends(7), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getDailyTrends).toHaveBeenCalledWith(7);
  });
});

describe('useLoansByStatus', () => {
  it('calls getLoansByStatus and returns data', async () => {
    const mockData = { active: 30, pending: 10, closed: 5 };
    (getLoansByStatus as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => useLoansByStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });
});

describe('useRecentActivity', () => {
  it('calls getRecentActivity with default limit of 20', async () => {
    const mockData = [{ id: '1', action: 'loan_approved' }];
    (getRecentActivity as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => useRecentActivity(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRecentActivity).toHaveBeenCalledWith(20);
    expect(result.current.data).toEqual(mockData);
  });

  it('calls getRecentActivity with custom limit', async () => {
    (getRecentActivity as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useRecentActivity(5), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRecentActivity).toHaveBeenCalledWith(5);
  });
});

describe('useFineractHealth', () => {
  it('calls getFineractReconciliation and returns data', async () => {
    const mockData = { synced: true, lastSync: '2026-03-15T10:00:00Z' };
    (getFineractReconciliation as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => useFineractHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('handles error gracefully', async () => {
    (getFineractReconciliation as jest.Mock).mockRejectedValue(
      new Error('Fineract unavailable')
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useFineractHealth(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error?.message).toBe('Fineract unavailable');
  });
});

describe('useCoreBankingHealth', () => {
  it('calls getCoreBankingHealth and returns data', async () => {
    const mockData = { status: 'healthy', uptime: 99.9 };
    (getCoreBankingHealth as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCoreBankingHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });
});
