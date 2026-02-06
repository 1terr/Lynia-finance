'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getDashboardMetrics,
  getPortfolioAtRisk,
  getDailyTrends,
  getLoansByStatus,
  getRecentActivity,
} from '@/lib/api/client';

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: getDashboardMetrics,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function usePortfolioAtRisk() {
  return useQuery({
    queryKey: ['dashboard', 'par'],
    queryFn: getPortfolioAtRisk,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDailyTrends(days: number = 30) {
  return useQuery({
    queryKey: ['dashboard', 'trends', days],
    queryFn: () => getDailyTrends(days),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLoansByStatus() {
  return useQuery({
    queryKey: ['dashboard', 'loans-by-status'],
    queryFn: getLoansByStatus,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentActivity(limit: number = 20) {
  return useQuery({
    queryKey: ['dashboard', 'activity', limit],
    queryFn: () => getRecentActivity(limit),
    staleTime: 60 * 1000,
  });
}
