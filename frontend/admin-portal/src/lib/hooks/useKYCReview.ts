'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
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
  const [data, setData] = useState<PaginatedResponse<KYCSubmission> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('kyc_submissions')
        .select('*, customers(*)', { count: 'exact' });

      // Apply status filter
      if (filters.status) {
        query = query.eq('status', filters.status);
      } else {
        query = query.in('status', ['pending', 'in_review']);
      }

      // Apply search filter
      if (filters.search) {
        query = query.or(
          `id_number.ilike.%${filters.search}%,submission_number.ilike.%${filters.search}%,customers.first_name.ilike.%${filters.search}%,customers.last_name.ilike.%${filters.search}%`
        );
      }

      // Apply confidence range filter
      if (filters.confidenceRange) {
        switch (filters.confidenceRange) {
          case 'low':
            query = query.lt('confidence_score', 50);
            break;
          case 'medium':
            query = query.gte('confidence_score', 50).lt('confidence_score', 85);
            break;
          case 'high':
            query = query.gte('confidence_score', 85);
            break;
        }
      }

      // Apply sorting
      const sortColumn = filters.sortBy || 'submitted_at';
      const ascending = filters.sortOrder === 'asc';
      query = query.order(sortColumn, { ascending });

      // Apply pagination
      const from = (filters.page - 1) * filters.limit;
      const to = from + filters.limit - 1;
      query = query.range(from, to);

      const { data: submissions, error: queryError, count } = await query;

      if (queryError) throw queryError;

      const total = count || 0;

      setData({
        data: (submissions as KYCSubmission[]) || [],
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch KYC queue');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('kyc-submissions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kyc_submissions',
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchQueue]);

  const updateFilters = useCallback((newFilters: Partial<KYCReviewFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  return {
    data,
    filters,
    isLoading,
    error,
    updateFilters,
    setPage,
    refetch: fetchQueue,
  };
}

export function useKYCSubmissionDetail(submissionId: string) {
  const [submission, setSubmission] = useState<KYCSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmission = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('kyc_submissions')
        .select('*, customers(*), kyc_manual_reviews(*, reviewer:admin_users(*))')
        .eq('id', submissionId)
        .single();

      if (queryError) throw queryError;
      setSubmission(data as KYCSubmission);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch submission');
    } finally {
      setIsLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  return { submission, isLoading, error, refetch: fetchSubmission };
}

export function useKYCActions() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const approveKYC = useCallback(
    async (submissionId: string, notes?: string) => {
      setIsSubmitting(true);
      try {
        // Update KYC submission status
        const { error: updateError } = await supabase
          .from('kyc_submissions')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            verified_at: new Date().toISOString(),
          })
          .eq('id', submissionId);

        if (updateError) throw updateError;

        // Insert manual review record
        const { error: reviewError } = await supabase
          .from('kyc_manual_reviews')
          .insert({
            kyc_submission_id: submissionId,
            action: 'approved',
            notes: notes || null,
            reviewed_at: new Date().toISOString(),
          });

        if (reviewError) throw reviewError;

        // Update customer KYC status
        const { data: submission } = await supabase
          .from('kyc_submissions')
          .select('customer_id')
          .eq('id', submissionId)
          .single();

        if (submission) {
          await supabase
            .from('customers')
            .update({
              kyc_status: 'approved',
              kyc_verified_at: new Date().toISOString(),
            })
            .eq('id', submission.customer_id);
        }

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
        // Update KYC submission status
        const { error: updateError } = await supabase
          .from('kyc_submissions')
          .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            rejection_reason: reason,
          })
          .eq('id', submissionId);

        if (updateError) throw updateError;

        // Insert manual review record
        const { error: reviewError } = await supabase
          .from('kyc_manual_reviews')
          .insert({
            kyc_submission_id: submissionId,
            action: 'rejected',
            reason,
            reviewed_at: new Date().toISOString(),
          });

        if (reviewError) throw reviewError;

        // Update customer KYC status
        const { data: submission } = await supabase
          .from('kyc_submissions')
          .select('customer_id')
          .eq('id', submissionId)
          .single();

        if (submission) {
          await supabase
            .from('customers')
            .update({ kyc_status: 'rejected' })
            .eq('id', submission.customer_id);
        }

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
