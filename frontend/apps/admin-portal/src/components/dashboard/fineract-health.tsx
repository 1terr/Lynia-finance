'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn, formatRelativeTime } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import type { ReconciliationResult } from '@/types/fineract';

interface FineractHealthProps {
  data: ReconciliationResult | undefined;
  isLoading: boolean;
}

export function FineractHealth({ data, isLoading }: FineractHealthProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Core Banking System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Core Banking System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-4 text-gray-500">
            <XCircle className="h-8 w-8 text-gray-400" />
            <p className="text-sm">Unable to load system status</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasDiscrepancies = data.discrepancyCount > 0;
  const highSeverity = data.discrepancies.filter((d) => d.severity === 'high').length;
  const syncHealthy = !hasDiscrepancies;

  const StatusIcon = syncHealthy ? CheckCircle2 : hasDiscrepancies && highSeverity > 0 ? XCircle : AlertTriangle;
  const statusColor = syncHealthy ? 'text-green-600' : highSeverity > 0 ? 'text-red-600' : 'text-yellow-600';
  const statusBg = syncHealthy ? 'bg-green-50' : highSeverity > 0 ? 'bg-red-50' : 'bg-yellow-50';
  const statusLabel = syncHealthy ? 'Healthy' : highSeverity > 0 ? 'Issues Detected' : 'Minor Discrepancies';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-gray-400" />
          Core Banking System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status Badge */}
          <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2', statusBg)}>
            <StatusIcon className={cn('h-5 w-5', statusColor)} />
            <span className={cn('text-sm font-medium', statusColor)}>{statusLabel}</span>
          </div>

          {/* Stats */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Last Reconciliation</span>
              <span className="font-medium text-gray-900">
                {formatRelativeTime(data.runAt)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Loans Checked</span>
              <span className="font-medium text-gray-900">{data.totalLoansChecked}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Matched</span>
              <span className="font-medium text-green-600">{data.matchedCount}</span>
            </div>
            {hasDiscrepancies && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Discrepancies</span>
                <span className="font-medium text-red-600">{data.discrepancyCount}</span>
              </div>
            )}
            {data.retriedSyncs > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Retry Success</span>
                <span className="font-medium text-gray-900">
                  {data.retrySuccessCount}/{data.retriedSyncs}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
