'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatRelativeTime } from '@lynia/utils';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity } from 'lucide-react';
import type { CoreBankingHealthResult } from '@/types/fineract';

// ============================================================
// Types
// ============================================================

interface CoreBankingHealthProps {
  data: CoreBankingHealthResult | undefined;
  isLoading: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

type HealthLevel = 'healthy' | 'warning' | 'critical';

// ============================================================
// Health computation
// ============================================================

function computeOverallHealth(data: CoreBankingHealthResult): HealthLevel {
  if (!data.infrastructure.fineractReachable) return 'critical';
  if (data.infrastructure.circuitBreakerState === 'OPEN') return 'critical';
  if (data.dataIntegrity.discrepancies.high > 0) return 'critical';

  if (data.infrastructure.circuitBreakerState === 'HALF_OPEN') return 'warning';
  if (data.syncPipeline.failedCount > 0) return 'warning';
  if (data.dataIntegrity.unsyncedLoans > 0) return 'warning';
  if (data.dataIntegrity.unsyncedPayments > 0) return 'warning';
  if (data.dataIntegrity.discrepancies.medium > 0) return 'warning';
  if (!data.accounting.trialBalanceBalanced) return 'warning';

  return 'healthy';
}

const HEALTH_CONFIG: Record<HealthLevel, {
  label: string;
  Icon: typeof CheckCircle2;
  color: string;
  bg: string;
}> = {
  healthy: { label: 'All Systems Healthy', Icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  warning: { label: 'Minor Issues Detected', Icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  critical: { label: 'Issues Detected', Icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
};

// ============================================================
// Sub-components
// ============================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
      {children}
    </p>
  );
}

function StatRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={cn('font-medium tabular-nums', warn ? 'text-red-600' : 'text-gray-900')}>
        {value}
      </span>
    </div>
  );
}

function StatusDot({ status }: { status: 'ok' | 'warn' | 'error' }) {
  const color = status === 'ok' ? 'bg-green-500' : status === 'warn' ? 'bg-yellow-500' : 'bg-red-500';
  return <span className={cn('inline-block h-2 w-2 rounded-full', color)} />;
}

function InfraRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'error';
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-gray-500">
        <StatusDot status={status} />
        {label}
      </span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

// ============================================================
// Skeleton
// ============================================================

function HealthSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-400" />
          Core Banking System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-9 animate-pulse rounded-lg bg-gray-100" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
                <div className="h-4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
          <div className="h-4 animate-pulse rounded bg-gray-200" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main component
// ============================================================

export function CoreBankingHealth({ data, isLoading, error, onRetry }: CoreBankingHealthProps) {
  if (isLoading) return <HealthSkeleton />;

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-400" />
            Core Banking System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4">
            <XCircle className="h-8 w-8 text-red-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Unable to load system status</p>
              {error && <p className="mt-1 text-xs text-gray-500">{error.message}</p>}
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const health = computeOverallHealth(data);
  const { label, Icon, color, bg } = HEALTH_CONFIG[health];
  const { infrastructure: infra, syncPipeline: sync, dataIntegrity: integrity, portfolio, accounting } = data;

  const circuitStatus: 'ok' | 'warn' | 'error' =
    infra.circuitBreakerState === 'CLOSED' ? 'ok' : infra.circuitBreakerState === 'HALF_OPEN' ? 'warn' : 'error';

  const latencyStatus: 'ok' | 'warn' | 'error' =
    infra.apiResponseMs < 1000 ? 'ok' : infra.apiResponseMs < 3000 ? 'warn' : 'error';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-400" />
            Core Banking System Health
          </CardTitle>
          {onRetry && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall Status Badge */}
          <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2', bg)}>
            <Icon className={cn('h-5 w-5', color)} />
            <span className={cn('text-sm font-medium', color)}>{label}</span>
          </div>

          {/* All sections in a single row on large screens */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
            {/* Infrastructure */}
            <div>
              <SectionLabel>Infrastructure</SectionLabel>
              <div className="space-y-1.5">
                <InfraRow
                  label="Core Banking"
                  value={infra.fineractReachable ? 'Connected' : 'Unreachable'}
                  status={infra.fineractReachable ? 'ok' : 'error'}
                />
                <InfraRow
                  label="Circuit"
                  value={infra.circuitBreakerState === 'HALF_OPEN' ? 'Half-Open' : infra.circuitBreakerState === 'CLOSED' ? 'Closed' : 'Open'}
                  status={circuitStatus}
                />
                <InfraRow
                  label="Latency"
                  value={infra.fineractReachable ? `${infra.apiResponseMs}ms` : '—'}
                  status={infra.fineractReachable ? latencyStatus : 'error'}
                />
              </div>
            </div>

            {/* Sync Pipeline */}
            <div>
              <SectionLabel>Sync Pipeline</SectionLabel>
              <div className="space-y-1.5">
                <StatRow label="Pending" value={sync.pendingCount} warn={sync.pendingCount > 10} />
                <StatRow label="Failed" value={sync.failedCount} warn={sync.failedCount > 0} />
                <StatRow label="Exhausted" value={sync.exhaustedCount} warn={sync.exhaustedCount > 0} />
                <StatRow
                  label="Success 24h"
                  value={sync.totalSyncs24h > 0 ? `${sync.successRate24h}%` : '—'}
                  warn={sync.successRate24h < 90 && sync.totalSyncs24h > 0}
                />
                <StatRow
                  label="Last Sync"
                  value={sync.lastSyncAt ? formatRelativeTime(sync.lastSyncAt) : '—'}
                />
              </div>
            </div>

            {/* Data Integrity */}
            <div>
              <SectionLabel>Data Integrity</SectionLabel>
              <div className="space-y-1.5">
                <StatRow label="Unsynced Customers" value={integrity.unsyncedCustomers} warn={integrity.unsyncedCustomers > 0} />
                <StatRow label="Unsynced Loans" value={integrity.unsyncedLoans} warn={integrity.unsyncedLoans > 0} />
                <StatRow label="Unsynced Payments" value={integrity.unsyncedPayments} warn={integrity.unsyncedPayments > 0} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Discrepancies</span>
                  <span className="flex items-center gap-1.5 font-medium tabular-nums">
                    <span className={cn(integrity.discrepancies.high > 0 ? 'text-red-600' : 'text-gray-400')}>
                      {integrity.discrepancies.high}H
                    </span>
                    <span className={cn(integrity.discrepancies.medium > 0 ? 'text-yellow-600' : 'text-gray-400')}>
                      {integrity.discrepancies.medium}M
                    </span>
                    <span className="text-gray-400">
                      {integrity.discrepancies.low}L
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Portfolio */}
            <div>
              <SectionLabel>Portfolio</SectionLabel>
              <div className="space-y-1.5">
                <StatRow label="Loans Checked" value={portfolio.totalLoansChecked} />
                <StatRow label="Matched" value={portfolio.matchedCount} />
                <StatRow label="Discrepancies" value={portfolio.discrepancyCount} warn={portfolio.discrepancyCount > 0} />
                <StatRow
                  label="Last Recon"
                  value={portfolio.lastReconciliationAt ? formatRelativeTime(portfolio.lastReconciliationAt) : '—'}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Accounting */}
          <div>
            <SectionLabel>Accounting</SectionLabel>
            <div className="grid grid-cols-2 gap-x-8 lg:grid-cols-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-500">
                  <StatusDot status={accounting.trialBalanceBalanced ? 'ok' : 'warn'} />
                  Trial Balance
                </span>
                <span className={cn('font-medium', accounting.trialBalanceBalanced ? 'text-green-600' : 'text-yellow-600')}>
                  {accounting.trialBalanceBalanced ? 'Balanced' : `$${accounting.imbalance.toFixed(2)} off`}
                </span>
              </div>
              <StatRow
                label="Last Entry"
                value={accounting.lastJournalEntryAt || '—'}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
