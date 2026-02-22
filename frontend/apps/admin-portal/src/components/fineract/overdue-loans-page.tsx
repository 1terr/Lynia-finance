'use client';

/**
 * Overdue Loans Page with Aging Analysis (Phase 7 - T019)
 *
 * Displays overdue loans with aging buckets (1-30, 31-60, 61-90, 90+),
 * device lock status, and portfolio-at-risk metrics.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getOverdueLoans, getAgingSummary } from '@/lib/api/fineract';
import { formatCurrency, formatDate } from '@lynia/utils';
import { getFineractStatusDisplay, type OverdueLoan } from '@/types/fineract';
import { Pagination } from '@/components/ui/pagination';
import {
  AlertTriangle,
  Clock,
  Lock,
  Unlock,
  TrendingDown,
} from 'lucide-react';

const BUCKET_COLORS = {
  '1-30': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  '31-60': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  '61-90': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  '90+': { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-300' },
};

export default function OverdueLoansPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data: aging } = useQuery({
    queryKey: ['aging-summary'],
    queryFn: getAgingSummary,
  });

  const { data: overdueData, isLoading } = useQuery({
    queryKey: ['overdue-loans', page],
    queryFn: () => getOverdueLoans(page),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overdue Loans</h1>
        <p className="text-sm text-gray-500">
          Portfolio aging analysis and delinquency tracking.
        </p>
      </div>

      {/* Aging Summary Cards */}
      {aging && (
        <>
          {/* Total Overdue Banner */}
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
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
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
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
          <tbody className="divide-y divide-gray-100">
            {isLoading &&
              [1, 2, 3].map((i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-4 py-4">
                    <div className="h-4 animate-pulse rounded bg-gray-200" />
                  </td>
                </tr>
              ))}
            {(overdueData?.data || []).map((loan) => (
              <tr
                key={loan.lyniaLoanId}
                className="cursor-pointer text-gray-700 hover:bg-gray-50"
                onClick={() =>
                  router.push(`/loans/${loan.lyniaLoanId}/fineract`)
                }
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">
                    {loan.customerName}
                  </p>
                  <p className="text-xs text-gray-500">
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
                        <p className="text-xs text-gray-500">
                          {formatCurrency(loan.lastPaymentAmount)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Never</span>
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
            <p className="mt-3 text-sm font-medium text-gray-600">
              No overdue loans
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
      <p className="mt-2 text-2xl font-bold text-gray-900">{count}</p>
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
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      <Unlock className="h-3 w-3" />
      unlocked
    </span>
  );
}
