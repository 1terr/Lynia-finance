'use client';

import { useCallback, useMemo } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { KYCReviewCard } from '@/components/kyc-review/KYCReviewCard';
import { KYCReviewFilters } from '@/components/kyc-review/KYCReviewFilters';
import { KYCQueueStats } from '@/components/kyc-review/KYCQueueStats';
import { useKYCReviewQueue } from '@/lib/hooks/useKYCReview';

export default function KYCReviewPage() {
  const { data, filters, isLoading, error, updateFilters, setPage, refetch } =
    useKYCReviewQueue();

  const handleSearch = useCallback(
    (query: string) => {
      updateFilters({ search: query });
    },
    [updateFilters]
  );

  const handleActionComplete = useCallback(() => {
    refetch();
  }, [refetch]);

  // Calculate stats from current data
  const stats = useMemo(() => {
    if (!data) return { total: 0, pending: 0, approved: 0, rejected: 0 };
    return {
      total: data.total,
      pending: data.data.filter(
        (s) => s.status === 'pending' || s.status === 'in_review'
      ).length,
      approved: data.data.filter((s) => s.status === 'approved').length,
      rejected: data.data.filter((s) => s.status === 'rejected').length,
    };
  }, [data]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KYC Review Queue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and verify customer identity submissions. Manual review is
            required for submissions with 50-84% confidence scores.
          </p>
        </div>
        <Button variant="secondary" onClick={refetch} disabled={isLoading}>
          <RefreshCw
            className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <KYCQueueStats
        total={stats.total}
        pending={stats.pending}
        approved={stats.approved}
        rejected={stats.rejected}
      />

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search by name, ID number, or submission #..."
          onSearch={handleSearch}
          className="sm:max-w-sm"
        />
        <KYCReviewFilters
          filters={filters}
          onFilterChange={updateFilters}
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Failed to load KYC queue</p>
          <p className="mt-1">{error}</p>
          <Button variant="secondary" size="sm" onClick={refetch} className="mt-2">
            Try Again
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !data && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-gray-200"
            />
          ))}
        </div>
      )}

      {/* Results */}
      {data && !isLoading && data.data.length === 0 && (
        <EmptyState
          title="No KYC submissions found"
          description={
            filters.search || filters.status !== 'in_review'
              ? 'Try adjusting your search or filter criteria.'
              : 'All KYC submissions have been reviewed. Check back later.'
          }
          icon={<ShieldAlert className="h-12 w-12" />}
        />
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="space-y-4">
            {data.data.map((submission) => (
              <KYCReviewCard
                key={submission.id}
                submission={submission}
                onActionComplete={handleActionComplete}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={data.limit}
              onPageChange={setPage}
              className="rounded-lg"
            />
          )}
        </>
      )}
    </div>
  );
}
