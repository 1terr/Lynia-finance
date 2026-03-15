'use client';

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
    <div className="flex items-center justify-between border-t border-border bg-muted px-6 py-3">
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{from}</span> to{' '}
        <span className="font-medium">{to}</span> of{' '}
        <span className="font-medium">{total}</span> results
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="rounded border border-border px-3 py-1 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        {totalPages <= 7 &&
          Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`rounded border px-3 py-1 text-sm font-medium ${
                p === page
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:bg-accent'
              }`}
            >
              {p}
            </button>
          ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded border border-border px-3 py-1 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
