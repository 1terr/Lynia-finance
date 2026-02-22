'use client';

import { Filter, ArrowUpDown } from 'lucide-react';
import { cn } from '@lynia/utils';
import type { KYCReviewFilters as FilterType } from '@/types';

interface KYCReviewFiltersProps {
  filters: FilterType;
  onFilterChange: (filters: Partial<FilterType>) => void;
  className?: string;
}

export function KYCReviewFilters({
  filters,
  onFilterChange,
  className,
}: KYCReviewFiltersProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {/* Status Filter */}
      <div className="flex items-center gap-1.5">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={filters.status || ''}
          onChange={(e) =>
            onFilterChange({
              status: (e.target.value || undefined) as FilterType['status'],
            })
          }
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_review">In Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Confidence Range Filter */}
      <select
        value={filters.confidenceRange || ''}
        onChange={(e) =>
          onFilterChange({
            confidenceRange: (e.target.value || undefined) as FilterType['confidenceRange'],
          })
        }
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">All Confidence</option>
        <option value="high">High (85%+)</option>
        <option value="medium">Medium (50-84%)</option>
        <option value="low">Low (&lt;50%)</option>
      </select>

      {/* Sort Control */}
      <div className="flex items-center gap-1.5">
        <ArrowUpDown className="h-4 w-4 text-gray-400" />
        <select
          value={`${filters.sortBy || 'submitted_at'}_${filters.sortOrder || 'asc'}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split('_') as [
              FilterType['sortBy'],
              FilterType['sortOrder']
            ];
            onFilterChange({ sortBy, sortOrder });
          }}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="submitted_at_asc">Oldest First</option>
          <option value="submitted_at_desc">Newest First</option>
          <option value="confidence_score_asc">Confidence: Low to High</option>
          <option value="confidence_score_desc">Confidence: High to Low</option>
        </select>
      </div>
    </div>
  );
}
