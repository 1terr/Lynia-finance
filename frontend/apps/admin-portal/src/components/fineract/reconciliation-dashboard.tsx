'use client';

/**
 * Reconciliation Dashboard (Phase 7 - T013)
 *
 * Compares Lynia DB balances against Fineract core banking engine
 * and displays discrepancies with severity indicators.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getReconciliationResults,
  triggerReconciliation,
} from '@/lib/api/fineract';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatCurrency, formatDateTime } from '@lynia/utils';
import type { ReconciliationDiscrepancy } from '@/types/fineract';
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Activity,
} from 'lucide-react';

const SEVERITY_STYLES: Record<
  string,
  { bg: string; text: string; icon: React.ReactNode }
> = {
  low: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  medium: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  high: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    icon: <XCircle className="h-4 w-4" />,
  },
};

export default function ReconciliationDashboard() {
  const queryClient = useQueryClient();
  const canReconcile = useAuthStore((s) => s.hasPermission('payments:reconcile'));

  const { data, isLoading } = useQuery({
    queryKey: ['fineract-reconciliation'],
    queryFn: getReconciliationResults,
  });

  const triggerMutation = useMutation({
    mutationFn: triggerReconciliation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['fineract-reconciliation'],
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-gray-100"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reconciliation</h1>
          <p className="text-sm text-gray-500">
            Lynia Database vs Fineract Core Banking Engine
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-gray-400">
            Last run: {formatDateTime(data.runAt)}
          </p>
          {canReconcile && (
            <button
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  triggerMutation.isPending ? 'animate-spin' : ''
                }`}
              />
              Run Reconciliation
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Loans Checked"
          value={String(data.totalLoansChecked)}
          icon={<Activity className="h-5 w-5 text-blue-500" />}
        />
        <SummaryCard
          label="Matched"
          value={String(data.matchedCount)}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          highlight="green"
        />
        <SummaryCard
          label="Discrepancies"
          value={String(data.discrepancyCount)}
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          highlight={data.discrepancyCount > 0 ? 'orange' : undefined}
        />
        <SummaryCard
          label="Retried Syncs"
          value={`${data.retrySuccessCount}/${data.retriedSyncs}`}
          icon={<RefreshCw className="h-5 w-5 text-purple-500" />}
          subtitle="successful"
        />
      </div>

      {/* Discrepancy Table */}
      {data.discrepancies.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Discrepancies
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="pb-3 pr-4">Customer</th>
                  <th className="pb-3 pr-4">Fineract Loan</th>
                  <th className="pb-3 pr-4 text-right">Lynia Balance</th>
                  <th className="pb-3 pr-4 text-right">
                    Fineract Balance
                  </th>
                  <th className="pb-3 pr-4 text-right">Difference</th>
                  <th className="pb-3 pr-4">Severity</th>
                  <th className="pb-3">Last Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.discrepancies.map((d) => {
                  const sev = SEVERITY_STYLES[d.severity] || SEVERITY_STYLES.low;
                  return (
                    <tr key={d.lyniaLoanId} className="text-gray-700">
                      <td className="py-3 pr-4 font-medium">
                        {d.customerName}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-gray-500">
                        #{d.fineractLoanId}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {formatCurrency(d.lyniaBalance)}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {formatCurrency(d.fineractBalance)}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium text-red-600">
                        {formatCurrency(Math.abs(d.difference))}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sev.bg} ${sev.text}`}
                        >
                          {sev.icon}
                          {d.severity}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-gray-500">
                        {formatDateTime(d.lastSyncedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All matched */}
      {data.discrepancies.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-green-200 bg-green-50 py-12">
          <CheckCircle className="h-12 w-12 text-green-400" />
          <p className="mt-4 text-lg font-medium text-green-700">
            All Balanced
          </p>
          <p className="mt-1 text-sm text-green-500">
            Lynia and Fineract balances are in sync.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  subtitle,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  highlight?: 'green' | 'orange' | 'red';
}) {
  const borderColors = {
    green: 'border-green-200 bg-green-50',
    orange: 'border-orange-200 bg-orange-50',
    red: 'border-red-200 bg-red-50',
  };

  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? borderColors[highlight] : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && (
        <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}
