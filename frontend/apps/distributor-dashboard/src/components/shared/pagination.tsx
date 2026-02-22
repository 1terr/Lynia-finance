'use client';

import { cn } from '@lynia/utils';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between border-t bg-muted/50 px-6 py-3">
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span> to{' '}
        <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span> results
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={cn(
            'rounded-md border bg-background px-3 py-1 text-sm font-medium',
            'hover:bg-accent hover:text-accent-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors'
          )}
        >
          Previous
        </button>
        {totalPages <= 7 &&
          Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'rounded-md border px-3 py-1 text-sm font-medium transition-colors',
                p === page
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {p}
            </button>
          ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            'rounded-md border bg-background px-3 py-1 text-sm font-medium',
            'hover:bg-accent hover:text-accent-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors'
          )}
        >
          Next
        </button>
      </div>
    </div>
  );
}
