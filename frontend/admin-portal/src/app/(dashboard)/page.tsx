'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  useDashboardMetrics,
  usePortfolioAtRisk,
  useDailyTrends,
  useLoansByStatus,
  useRecentActivity,
} from '@/lib/hooks/use-dashboard-data';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PortfolioChart } from '@/components/dashboard/portfolio-chart';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { PARChart } from '@/components/dashboard/par-chart';
import { RecentActivityFeed } from '@/components/dashboard/recent-activity';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { DateRangePicker, dateRangeToDays, type DateRange } from '@/components/dashboard/date-range-picker';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import {
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Smartphone,
  Lock,
  ClipboardCheck,
  Clock,
  Banknote,
  UserPlus,
  Percent,
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

      {/* KPI Grid */}
      {metricsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : metrics ? (
        <>
          {/* Primary KPIs - Row 1 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Customers"
              value={formatNumber(metrics.total_customers)}
              icon={Users}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
              change={metrics.new_customers_this_month > 0 ? (metrics.new_customers_this_month / Math.max(metrics.total_customers - metrics.new_customers_this_month, 1)) * 100 : 0}
              changeLabel="this month"
            />
            <MetricCard
              title="Active Loans"
              value={formatNumber(metrics.active_loans)}
              subtitle={formatCurrency(metrics.outstanding_balance_usd)}
              icon={FileText}
              iconColor="text-indigo-600"
              iconBg="bg-indigo-50"
            />
            <MetricCard
              title="Total Disbursed"
              value={formatCurrency(metrics.total_disbursed_usd)}
              icon={DollarSign}
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

          {/* Secondary KPIs - Row 2 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Collection Rate"
              value={formatPercent(metrics.collection_rate)}
              icon={TrendingUp}
              iconColor="text-teal-600"
              iconBg="bg-teal-50"
            />
            <MetricCard
              title="Default Rate"
              value={formatPercent(metrics.default_rate)}
              icon={Percent}
              iconColor="text-red-600"
              iconBg="bg-red-50"
            />
            <MetricCard
              title="Overdue Payments"
              value={formatNumber(metrics.overdue_payments)}
              subtitle={formatCurrency(metrics.overdue_amount_usd)}
              icon={AlertTriangle}
              iconColor="text-orange-600"
              iconBg="bg-orange-50"
            />
            <MetricCard
              title="New Customers"
              value={formatNumber(metrics.new_customers_this_month)}
              changeLabel="this month"
              icon={UserPlus}
              iconColor="text-violet-600"
              iconBg="bg-violet-50"
            />
          </div>

          {/* Device & Operations KPIs - Row 3 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Devices in Stock"
              value={formatNumber(metrics.devices_in_stock)}
              icon={Smartphone}
              iconColor="text-cyan-600"
              iconBg="bg-cyan-50"
            />
            <MetricCard
              title="Active Devices"
              value={formatNumber(metrics.devices_active)}
              icon={Smartphone}
              iconColor="text-green-600"
              iconBg="bg-green-50"
            />
            <MetricCard
              title="Locked Devices"
              value={formatNumber(metrics.devices_locked)}
              icon={Lock}
              iconColor="text-red-600"
              iconBg="bg-red-50"
            />
            <MetricCard
              title="Pending KYC"
              value={formatNumber(metrics.pending_kyc)}
              icon={ClipboardCheck}
              iconColor="text-purple-600"
              iconBg="bg-purple-50"
            />
          </div>
        </>
      ) : null}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TrendChart data={trends || []} />
        <PortfolioChart data={loansByStatus || []} />
      </div>

      {/* PAR + Quick Actions + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <PARChart data={par || { par_0_30: 0, par_31_60: 0, par_61_90: 0, par_90_plus: 0 }} />
        <QuickActions
          role={user?.role || 'customer_support'}
          pendingKyc={metrics?.pending_kyc || 0}
          pendingApprovals={metrics?.pending_approvals || 0}
        />
        <RecentActivityFeed activities={activities || []} />
      </div>
    </div>
  );
}
