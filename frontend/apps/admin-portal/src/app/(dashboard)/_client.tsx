'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  useDashboardMetrics,
  usePortfolioAtRisk,
  useDailyTrends,
  useLoansByStatus,
  useRecentActivity,
  useFineractHealth,
} from '@/lib/hooks/use-dashboard-data';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PortfolioChart } from '@/components/dashboard/portfolio-chart';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { PARChart } from '@/components/dashboard/par-chart';
import { RecentActivityFeed } from '@/components/dashboard/recent-activity';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { FineractHealth } from '@/components/dashboard/fineract-health';
import { AlertsPanel } from '@/components/dashboard/alerts-panel';
import { DateRangePicker, dateRangeToDays, type DateRange } from '@/components/dashboard/date-range-picker';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Banknote,
  FileText,
} from 'lucide-react';

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const days = dateRangeToDays(dateRange);

  const { user } = useAuth();
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: par } = usePortfolioAtRisk();
  const { data: trends } = useDailyTrends(days);
  const { data: loansByStatus } = useLoansByStatus();
  const { data: activities } = useRecentActivity();
  const { data: fineractHealth, isLoading: fineractLoading } = useFineractHealth();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome back, {user?.first_name || 'Admin'}. Here&apos;s your portfolio overview.
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Tier 1: Executive Summary - 6 Focused KPIs */}
      {metricsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-lg bg-gray-200" />
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
              subtitle={metrics.portfolio_outstanding_fineract !== null ? 'Fineract source' : 'Lynia DB'}
              icon={DollarSign}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
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
        <FineractHealth data={fineractHealth} isLoading={fineractLoading} />
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
