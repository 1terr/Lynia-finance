'use client';

/**
 * Overdue Loans Page with Aging Analysis (Phase 7 - T019)
 *
 * Displays overdue loans with aging buckets (1-30, 31-60, 61-90, 90+),
 * device lock status, and portfolio-at-risk metrics.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getOverdueLoans, getAgingSummary } from '@/lib/api/fineract';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatCurrency, formatDate } from '@lynia/utils';
import { getFineractStatusDisplay, type OverdueLoan } from '@/types/fineract';
import { Pagination } from '@/components/ui/pagination';
import {
  AlertTriangle,
  Clock,
  Lock,
  Unlock,
  TrendingDown,
  Search,
  X,
  Download,
} from 'lucide-react';

const BUCKET_COLORS = {
  '1-30': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  '31-60': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  '61-90': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  '90+': { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-300' },
};

// ---------------------------------------------------------------------------
// CSV Export Helper
// ---------------------------------------------------------------------------

function downloadOverdueCSV(loans: OverdueLoan[]) {
  if (!loans.length) return;

  const headers = [
    'Loan ID',
    'Customer Name',
    'Phone',
    'Product',
    'Days Past Due',
    'Outstanding Amount',
    'Overdue Amount',
    'Lock Status',
    'Status',
    'Aging Bucket',
    'Last Payment Date',
  ];

  /** Escape a cell value for CSV with formula-injection protection */
  const escapeCell = (val: unknown): string => {
    let str = val === null || val === undefined ? '' : String(val);
    // Protect against formula injection
    if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const rows = loans.map((loan) => [
    loan.lyniaLoanId,
    loan.customerName,
    loan.customerPhone || '',
    loan.productName.replace('Lynia Device Finance - ', ''),
    loan.daysPastDue,
    loan.totalOutstanding,
    loan.totalOverdue,
    loan.deviceLockStatus,
    getFineractStatusDisplay(loan.status.code).label,
    loan.agingBucket,
    loan.lastPaymentDate || '',
  ]);

  const csv = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `overdue-loans-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function OverdueLoansPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput);

  const { data: aging } = useQuery({
    queryKey: ['aging-summary'],
    queryFn: getAgingSummary,
  });

  const { data: overdueData, isLoading } = useQuery({
    queryKey: ['overdue-loans', page, debouncedSearch],
    queryFn: () => getOverdueLoans(page, 25, debouncedSearch || undefined),
  });

  const handleExport = useCallback(() => {
    downloadOverdueCSV(overdueData?.data || []);
  }, [overdueData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Overdue Loans</h1>
          <p className="text-sm text-muted-foreground">
            Portfolio aging analysis and delinquency tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {overdueData && (
            <p className="text-sm text-muted-foreground">
              {overdueData.total} overdue loan{overdueData.total !== 1 ? 's' : ''}
            </p>
          )}
          <button
            onClick={handleExport}
            disabled={!overdueData?.data?.length}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-accent disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, phone, national ID, or loan number..."
          className="block w-full rounded-md border border-border py-2 pl-10 pr-8 text-sm shadow-sm placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-border dark:bg-card dark:text-foreground"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Aging Summary Cards */}
      {aging && (
        <>
          {/* Total Overdue Banner */}
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-6 w-6 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Total Overdue Portfolio
                  </p>
                  <p className="text-2xl font-bold text-red-900">
                    {formatCurrency(aging.totalOverdueAmount)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-red-900">
                  {aging.totalOverdueLoans}
                </p>
                <p className="text-sm text-red-600">overdue loans</p>
              </div>
            </div>
          </div>

          {/* Aging Buckets */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AgingBucketCard
              label="1-30 Days"
              count={aging.bucket_1_30.count}
              amount={aging.bucket_1_30.totalOverdue}
              bucket="1-30"
            />
            <AgingBucketCard
              label="31-60 Days"
              count={aging.bucket_31_60.count}
              amount={aging.bucket_31_60.totalOverdue}
              bucket="31-60"
            />
            <AgingBucketCard
              label="61-90 Days"
              count={aging.bucket_61_90.count}
              amount={aging.bucket_61_90.totalOverdue}
              bucket="61-90"
            />
            <AgingBucketCard
              label="90+ Days"
              count={aging.bucket_90_plus.count}
              amount={aging.bucket_90_plus.totalOverdue}
              bucket="90+"
            />
          </div>
        </>
      )}

      {/* Overdue Loans Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-xs font-medium uppercase text-muted-foreground">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Outstanding</th>
              <th className="px-4 py-3 text-right">Overdue</th>
              <th className="px-4 py-3 text-center">DPD</th>
              <th className="px-4 py-3">Bucket</th>
              <th className="px-4 py-3">Last Payment</th>
              <th className="px-4 py-3">Device Lock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading &&
              [1, 2, 3].map((i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-4 py-4">
                    <div className="h-4 animate-pulse rounded bg-muted" />
                  </td>
                </tr>
              ))}
            {(overdueData?.data || []).map((loan) => (
              <tr
                key={loan.lyniaLoanId}
                className="cursor-pointer text-foreground hover:bg-muted"
                onClick={() =>
                  router.push(`/loans/${loan.lyniaLoanId}/fineract`)
                }
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">
                    {loan.customerName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {loan.customerPhone}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs">
                  {loan.productName.replace(
                    'Lynia Device Finance - ',
                    ''
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrency(loan.totalOutstanding)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-red-600">
                  {formatCurrency(loan.totalOverdue)}
                </td>
                <td className="px-4 py-3 text-center font-bold text-red-700">
                  {loan.daysPastDue}
                </td>
                <td className="px-4 py-3">
                  <AgingBadge bucket={loan.agingBucket} />
                </td>
                <td className="px-4 py-3">
                  {loan.lastPaymentDate ? (
                    <div>
                      <p className="text-xs">
                        {formatDate(loan.lastPaymentDate)}
                      </p>
                      {loan.lastPaymentAmount && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(loan.lastPaymentAmount)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Never</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <LockStatusBadge status={loan.deviceLockStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {overdueData && overdueData.data.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Clock className="h-10 w-10 text-green-400" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              {debouncedSearch ? 'No matching overdue loans' : 'No overdue loans'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {overdueData && overdueData.total_pages > 1 && (
        <Pagination
          page={overdueData.page}
          totalPages={overdueData.total_pages}
          total={overdueData.total}
          pageSize={overdueData.limit}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function AgingBucketCard({
  label,
  count,
  amount,
  bucket,
}: {
  label: string;
  count: number;
  amount: number;
  bucket: keyof typeof BUCKET_COLORS;
}) {
  const colors = BUCKET_COLORS[bucket];

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${colors.text}`}>{label}</span>
        <AlertTriangle className={`h-4 w-4 ${colors.text}`} />
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{count}</p>
      <p className={`mt-1 text-sm font-medium ${colors.text}`}>
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

function AgingBadge({
  bucket,
}: {
  bucket: '1-30' | '31-60' | '61-90' | '90+';
}) {
  const colors = BUCKET_COLORS[bucket];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {bucket}
    </span>
  );
}

function LockStatusBadge({
  status,
}: {
  status: 'unlocked' | 'locked' | 'pending';
}) {
  if (status === 'locked') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        <Lock className="h-3 w-3" />
        locked
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
        <Clock className="h-3 w-3" />
        pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <Unlock className="h-3 w-3" />
      unlocked
    </span>
  );
}
