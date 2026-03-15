'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  useDashboardMetrics,
  usePortfolioAtRisk,
  useDailyTrends,
  useLoansByStatus,
  useRecentActivity,
  useCoreBankingHealth,
} from '@/lib/hooks/use-dashboard-data';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PortfolioChart } from '@/components/dashboard/portfolio-chart';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { PARChart } from '@/components/dashboard/par-chart';
import { RecentActivityFeed } from '@/components/dashboard/recent-activity';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { CoreBankingHealth } from '@/components/dashboard/core-banking-health';
import { AlertsPanel } from '@/components/dashboard/alerts-panel';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker, dateRangeToDays, type DateRange } from '@/components/dashboard/date-range-picker';
import { formatCurrency, formatNumber, formatPercent, formatRelativeTime } from '@lynia/utils';
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Banknote,
  FileText,
  RefreshCw,
} from 'lucide-react';

function MetricCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-3.5 w-20 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-100" />
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const days = dateRangeToDays(dateRange);

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: metrics, isLoading: metricsLoading, dataUpdatedAt: metricsUpdatedAt } = useDashboardMetrics();
  const { data: par } = usePortfolioAtRisk();
  const { data: trends } = useDailyTrends(days);
  const { data: loansByStatus } = useLoansByStatus();
  const { data: activities } = useRecentActivity();
  const {
    data: fineractHealth,
    isLoading: fineractLoading,
    error: fineractError,
    refetch: refetchFineract,
  } = useCoreBankingHealth();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const fineractDegraded = !fineractLoading && fineractHealth?.infrastructure.fineractReachable === false;

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    await queryClient.invalidateQueries({ queryKey: ['fineract'] });
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-6">
      {/* Degraded state banner */}
      {fineractDegraded && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">
              Dashboard running in degraded mode
            </p>
            <p className="text-xs text-yellow-700">
              Core banking system is unreachable. Metrics are showing Lynia DB data only.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchFineract()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome back, {user?.first_name || 'Admin'}. Here&apos;s your portfolio overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {metricsUpdatedAt > 0 && (
            <span className="text-xs text-gray-400">
              Updated {formatRelativeTime(new Date(metricsUpdatedAt).toISOString())}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            isLoading={isRefreshing}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Tier 1: Executive Summary - 6 Focused KPIs */}
      {metricsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      ) : metrics ? (
        <>
          {/* Row 1: Portfolio Outstanding, Active Borrowers, PAR 30 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Portfolio Outstanding"
              value={formatCurrency(
                metrics.portfolio_outstanding_fineract ?? metrics.outstanding_balance_usd
              )}
              subtitle={metrics.portfolio_outstanding_fineract !== null ? 'Core banking' : 'Lynia DB'}
              icon={DollarSign}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
              dataSource={metrics.portfolio_outstanding_fineract !== null ? 'fineract_verified' : 'db_only'}
            />
            <MetricCard
              title="Active Borrowers"
              value={formatNumber(metrics.active_loans)}
              subtitle={`Avg loan: ${formatCurrency(metrics.avg_loan_size_usd)}`}
              icon={Users}
              iconColor="text-indigo-600"
              iconBg="bg-indigo-50"
            />
            <MetricCard
              title="PAR 30"
              value={formatPercent(metrics.par_30_pct ?? metrics.default_rate)}
              subtitle="Portfolio at risk > 30 days"
              icon={AlertTriangle}
              iconColor={
                (metrics.par_30_pct ?? metrics.default_rate) > 5
                  ? 'text-red-600'
                  : 'text-green-600'
              }
              iconBg={
                (metrics.par_30_pct ?? metrics.default_rate) > 5
                  ? 'bg-red-50'
                  : 'bg-green-50'
              }
              dataSource={metrics.par_30_pct !== null ? 'fineract_verified' : 'db_only'}
            />
          </div>

          {/* Row 2: Collection Rate, Monthly Disbursements, Monthly Revenue */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Collection Rate"
              value={formatPercent(metrics.collection_rate)}
              icon={TrendingUp}
              iconColor="text-teal-600"
              iconBg="bg-teal-50"
            />
            <MetricCard
              title="Disbursements"
              value={formatCurrency(metrics.disbursements_this_month)}
              subtitle="This month"
              icon={FileText}
              iconColor="text-green-600"
              iconBg="bg-green-50"
            />
            <MetricCard
              title="Monthly Revenue"
              value={formatCurrency(metrics.monthly_revenue_usd)}
              icon={Banknote}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
            />
          </div>
        </>
      ) : null}

      {/* Tier 2: Portfolio Trends - Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TrendChart data={trends || []} />
        <PortfolioChart data={loansByStatus || []} />
      </div>

      {/* Tier 3: Risk & Fineract Health */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PARChart data={par || { par_0_30: 0, par_31_60: 0, par_61_90: 0, par_90_plus: 0 }} />
        <CoreBankingHealth
          data={fineractHealth}
          isLoading={fineractLoading}
          error={fineractError}
          onRetry={() => refetchFineract()}
        />
      </div>

      {/* Tier 4: Operations - Quick Actions, Alerts, Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <QuickActions
          role={user?.role || 'customer_support'}
          pendingKyc={metrics?.pending_kyc || 0}
          pendingApprovals={metrics?.pending_approvals || 0}
        />
        <AlertsPanel
          metrics={metrics}
          fineractDiscrepancies={metrics?.fineract_discrepancies}
        />
        <RecentActivityFeed activities={activities || []} />
      </div>
    </div>
  );
}
