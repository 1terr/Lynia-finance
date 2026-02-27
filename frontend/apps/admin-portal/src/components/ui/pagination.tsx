'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@lynia/utils';
import { Button } from './button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit: limitProp,
  pageSize,
  onPageChange,
  className,
}: PaginationProps) {
  const limit = limitProp ?? pageSize ?? 25;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3',
        className
      )}
    >
      <div className="text-sm text-gray-700">
        Showing <span className="font-medium">{from}</span> to{' '}
        <span className="font-medium">{to}</span> of{' '}
        <span className="font-medium">{total}</span> results
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        {/* Page numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers(page, totalPages).map((pageNum, index) =>
            pageNum === null ? (
              <span key={`dots-${index}`} className="px-2 text-gray-400">
                ...
              </span>
            ) : (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  'h-8 min-w-[2rem] rounded text-sm font-medium',
                  pageNum === page
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                {pageNum}
              </button>
            )
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function getPageNumbers(
  current: number,
  total: number
): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, 4, null, total];
  }

  if (current >= total - 2) {
    return [1, null, total - 3, total - 2, total - 1, total];
  }

  return [1, null, current - 1, current, current + 1, null, total];
}
