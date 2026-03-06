'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@lynia/api-client';
import { useMutationWithToast } from '@/hooks/use-mutation-with-toast';
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

export function useKYCActions(onActionComplete?: () => void) {
  const approveMutation = useMutationWithToast<void, { submissionId: string; notes?: string }>({
    mutationFn: async ({ submissionId, notes }) => {
      await fetchAPI(`/api/v1/kyc/submissions/${submissionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      });
    },
    successMessage: 'KYC submission approved successfully',
    errorMessage: 'Failed to approve KYC submission',
    invalidateKeys: [['kyc-review-queue'], ['kyc-pending'], ['kyc-review-history'], ['kyc-sla-stats']],
    onSuccess: () => onActionComplete?.(),
  });

  const rejectMutation = useMutationWithToast<void, { submissionId: string; reason: string }>({
    mutationFn: async ({ submissionId, reason }) => {
      await fetchAPI(`/api/v1/kyc/submissions/${submissionId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    successMessage: 'KYC submission rejected',
    errorMessage: 'Failed to reject KYC submission',
    invalidateKeys: [['kyc-review-queue'], ['kyc-pending'], ['kyc-review-history'], ['kyc-sla-stats']],
    onSuccess: () => onActionComplete?.(),
  });

  return { approveMutation, rejectMutation };
}
