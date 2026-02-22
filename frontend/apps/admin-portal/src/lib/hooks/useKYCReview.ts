'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@lynia/api-client';
import type {
  KYCSubmission,
  KYCReviewFilters,
  PaginatedResponse,
} from '@/types';

const DEFAULT_FILTERS: KYCReviewFilters = {
  page: 1,
  limit: 20,
  status: 'in_review',
  sortBy: 'submitted_at',
  sortOrder: 'asc',
};

export function useKYCReviewQueue(initialFilters?: Partial<KYCReviewFilters>) {
  const [filters, setFilters] = useState<KYCReviewFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  const { data, isLoading, error, refetch } = useQuery<PaginatedResponse<KYCSubmission>>({
    queryKey: ['kyc-review-queue', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(filters.page));
      params.set('limit', String(filters.limit));
      if (filters.status) params.set('status', filters.status);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
      if (filters.search) params.set('search', filters.search);
      if (filters.confidenceRange) params.set('confidenceRange', filters.confidenceRange);

      return fetchAPI<PaginatedResponse<KYCSubmission>>(
        `/api/v1/kyc/submissions?${params.toString()}`
      );
    },
    // Poll every 30 seconds (Cognito-authenticated via fetchAPI)
    refetchInterval: 30_000,
  });

  const updateFilters = useCallback((newFilters: Partial<KYCReviewFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  return {
    data: data ?? null,
    filters,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    updateFilters,
    setPage,
    refetch,
  };
}

export function useKYCSubmissionDetail(submissionId: string) {
  const { data: submission, isLoading, error, refetch } = useQuery<KYCSubmission>({
    queryKey: ['kyc-submission', submissionId],
    queryFn: () => fetchAPI<KYCSubmission>(`/api/v1/kyc/submissions/${submissionId}`),
    enabled: !!submissionId,
  });

  return {
    submission: submission ?? null,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refetch,
  };
}

export function useKYCActions() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const approveKYC = useCallback(
    async (submissionId: string, notes?: string) => {
      setIsSubmitting(true);
      try {
        await fetchAPI(`/api/v1/kyc/submissions/${submissionId}/approve`, {
          method: 'POST',
          body: JSON.stringify({ notes }),
        });
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to approve KYC',
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const rejectKYC = useCallback(
    async (submissionId: string, reason: string) => {
      setIsSubmitting(true);
      try {
        await fetchAPI(`/api/v1/kyc/submissions/${submissionId}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to reject KYC',
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return { approveKYC, rejectKYC, isSubmitting };
}
