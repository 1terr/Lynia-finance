'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CommissionEntry, DashboardStats } from '@/types/distributor';
import { fetchCommissions, fetchDashboardStats, fetchDistributorProfile } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@lynia/utils';
import { CommissionsSkeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Clock,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Award,
  Target,
  BarChart3,
  Info,
} from 'lucide-react';

type PaymentFilter = 'all' | 'paid' | 'pending';
type PeriodFilter = 'all' | 'this_month' | 'last_month';

/** Determine performance tier based on total commissions earned */
function getPerformanceTier(totalEarned: number): {
  tier: string;
  color: string;
  next: string;
  progress: number;
} {
  if (totalEarned >= 500) {
    return { tier: 'Gold', color: 'text-yellow-500', next: 'Max tier', progress: 100 };
  }
  if (totalEarned >= 250) {
    return {
      tier: 'Silver',
      color: 'text-gray-400',
      next: `$${(500 - totalEarned).toFixed(0)} to Gold`,
      progress: Math.round(((totalEarned - 250) / 250) * 100),
    };
  }
  return {
    tier: 'Bronze',
    color: 'text-orange-600',
    next: `$${(250 - totalEarned).toFixed(0)} to Silver`,
    progress: Math.round((totalEarned / 250) * 100),
  };
}

/** Build monthly earnings for bar chart (last 6 months) */
function getMonthlyEarnings(commissions: CommissionEntry[]): { month: string; amount: number }[] {
  const now = new Date();
  const months: { month: string; amount: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const amount = commissions
      .filter((c) => {
        const cd = new Date(c.calculation_date);
        return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
      })
      .reduce((sum, c) => sum + c.commission_amount, 0);
    months.push({ month: label, amount });
  }
  return months;
}

function exportCSV(commissions: CommissionEntry[]) {
  const header = 'Date,Loan ID,Device,Customer,IMEI,Device Price,Rate,Commission,Status,Paid At\n';
  const rows = commissions
    .map(
      (c) =>
        `${new Date(c.calculation_date).toLocaleDateString('en-ZW')},${c.loan_id},${c.device_model},${c.customer_name},-,$${c.device_retail_price.toFixed(2)},${c.commission_percentage}%,$${c.commission_amount.toFixed(2)},${c.payment_status},${c.paid_at ? new Date(c.paid_at).toLocaleDateString('en-ZW') : '-'}`,
    )
    .join('\n');

  // Summary row
  const totalAmount = commissions.reduce((s, c) => s + c.commission_amount, 0);
  const paidAmount = commissions.filter((c) => c.payment_status === 'paid').reduce((s, c) => s + c.commission_amount, 0);
  const summary = `\n\nSummary,,,,,,,$${totalAmount.toFixed(2)} total ($${paidAmount.toFixed(2)} paid),,`;

  const blob = new Blob([header + rows + summary], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `commissions_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CommissionsPage() {
  const { data: commissions = [], isLoading: commissionsLoading, isError: commissionsError, refetch: refetchCommissions } = useQuery({
    queryKey: ['distributor', 'commissions'],
    queryFn: fetchCommissions,
  });

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['distributor', 'stats'],
    queryFn: fetchDashboardStats,
  });

  const { data: profile } = useQuery({
    queryKey: ['distributor', 'profile'],
    queryFn: fetchDistributorProfile,
  });

  const commissionRate = profile?.commission_rate ?? 5;

  const loading = commissionsLoading || statsLoading;
  const hasError = commissionsError || statsError;
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  const filteredCommissions = useMemo(() => {
    return commissions.filter((c) => {
      const matchesPayment =
        paymentFilter === 'all' || c.payment_status === paymentFilter;

      let matchesPeriod = true;
      if (periodFilter !== 'all') {
        const date = new Date(c.calculation_date);
        const now = new Date();
        if (periodFilter === 'this_month') {
          matchesPeriod =
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();
        } else if (periodFilter === 'last_month') {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
          matchesPeriod =
            date.getMonth() === lastMonth.getMonth() &&
            date.getFullYear() === lastMonth.getFullYear();
        }
      }

      return matchesPayment && matchesPeriod;
    });
  }, [commissions, paymentFilter, periodFilter]);

  const monthlyTotal = useMemo(() => {
    const now = new Date();
    return commissions
      .filter((c) => {
        const d = new Date(c.calculation_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, c) => sum + c.commission_amount, 0);
  }, [commissions]);

  const monthlyEarnings = useMemo(() => getMonthlyEarnings(commissions), [commissions]);
  const maxMonthly = Math.max(...monthlyEarnings.map((m) => m.amount), 1);

  const handoverCount = commissions.length;

  if (loading) {
    return <CommissionsSkeleton />;
  }

  if (hasError || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <DollarSign className="h-6 w-6 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Failed to load commissions</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Could not fetch your commission data. Please try again.
        </p>
        <button
          onClick={() => { refetchCommissions(); refetchStats(); }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const tier = getPerformanceTier(stats.total_commissions_earned);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Commissions & Earnings</h1>
          <p className="text-sm text-muted-foreground">
            Track your earnings and performance
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(filteredCommissions)}
          className="hidden sm:inline-flex"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-muted-foreground">
              Total Earned
            </span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            ${stats.total_commissions_earned.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {handoverCount} handovers
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-muted-foreground">
              Paid Out
            </span>
          </div>
          <p className="text-2xl font-bold">
            ${stats.total_commissions_paid.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {commissions.filter((c) => c.payment_status === 'paid').length} payments
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-xs font-medium text-muted-foreground">
              Pending
            </span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">
            ${stats.pending_commissions.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {commissions.filter((c) => c.payment_status === 'pending').length} awaiting
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-cyan-600" />
            <span className="text-xs font-medium text-muted-foreground">
              This Month
            </span>
          </div>
          <p className="text-2xl font-bold">${monthlyTotal.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.monthly_handovers} handovers
          </p>
        </div>
      </div>

      {/* Monthly earnings chart */}
      <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Monthly Earnings (Last 6 Months)
        </h2>
        <div className="flex items-end gap-2 h-32">
          {monthlyEarnings.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-muted-foreground">
                {m.amount > 0 ? `$${m.amount.toFixed(0)}` : ''}
              </span>
              <div
                className={cn(
                  'w-full rounded-t transition-all',
                  m.amount > 0 ? 'bg-primary' : 'bg-muted',
                )}
                style={{
                  height: `${Math.max((m.amount / maxMonthly) * 100, m.amount > 0 ? 8 : 4)}%`,
                  minHeight: 4,
                }}
              />
              <span className="text-[10px] text-muted-foreground">{m.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance tier + Commission calculation */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className={cn('h-5 w-5', tier.color)} />
              <h2 className="text-sm font-semibold">Performance Tier</h2>
            </div>
            <span className={cn('text-sm font-bold', tier.color)}>
              {tier.tier}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{tier.next}</span>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <div
                className={cn(
                  'h-2 rounded-full transition-all',
                  tier.tier === 'Gold'
                    ? 'bg-yellow-500'
                    : tier.tier === 'Silver'
                      ? 'bg-gray-400'
                      : 'bg-orange-500',
                )}
                style={{ width: `${tier.progress}%` }}
              />
            </div>
          </div>

          {/* Performance metrics */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold">{handoverCount}</p>
              <p className="text-[10px] text-muted-foreground">Total Handovers</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold">{commissionRate}%</p>
              <p className="text-[10px] text-muted-foreground">Commission Rate</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold">
                ${handoverCount > 0
                  ? (stats.total_commissions_earned / handoverCount).toFixed(2)
                  : '0.00'}
              </p>
              <p className="text-[10px] text-muted-foreground">Avg per Handover</p>
            </div>
          </div>
        </div>

        {/* How commission is calculated */}
        <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            How It Works
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <p>You earn <strong className="text-foreground">{commissionRate}%</strong> of the loan amount for each device handover you complete.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <p>Commission is calculated instantly when the handover is submitted and confirmed.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
              <p>Payouts are processed monthly on the 1st. Pending commissions are paid to your registered account.</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-muted-foreground">Example: $200 loan amount</p>
            <p className="text-sm font-semibold">
              $200 &times; {commissionRate}% = <span className="text-green-600">${(200 * commissionRate / 100).toFixed(2)}</span> commission
            </p>
          </div>
        </div>
      </div>

      {/* Payout schedule */}
      <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Upcoming Payout
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Next payout date</p>
            <p className="text-sm font-medium">
              {new Date(
                new Date().getFullYear(),
                new Date().getMonth() + 1,
                1,
              ).toLocaleDateString('en-ZW', {
                weekday: 'short',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Estimated amount</p>
            <p className="text-lg font-bold text-green-600">
              ${stats.pending_commissions.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Commission history - only show when there are commissions */}
      {commissions.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 shadow-sm text-center">
          <DollarSign className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-sm font-semibold mb-1">No commissions yet</h3>
          <p className="text-sm text-muted-foreground">
            Commissions are earned when you complete device handovers. They will appear here automatically.
          </p>
        </div>
      ) : (
      <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by payment status" className="flex items-center gap-1 rounded-lg border p-1">
          {(['all', 'paid', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPaymentFilter(f)}
              aria-pressed={paymentFilter === f}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                paymentFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              {f === 'all' ? 'All' : f === 'paid' ? 'Paid' : 'Pending'}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Filter by time period" className="flex items-center gap-1 rounded-lg border p-1">
          {(['all', 'this_month', 'last_month'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPeriodFilter(f)}
              aria-pressed={periodFilter === f}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                periodFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              {f === 'all'
                ? 'All Time'
                : f === 'this_month'
                  ? 'This Month'
                  : 'Last Month'}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(filteredCommissions)}
          className="sm:hidden ml-auto"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Commission history */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-4 md:p-5 border-b">
          <h2 className="text-sm font-semibold">Commission History</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filteredCommissions.length} entries
          </p>
        </div>
        {filteredCommissions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No commission entries match your filters
          </div>
        ) : (
          <div className="divide-y">
            {filteredCommissions.map((commission) => (
              <div
                key={commission.id}
                className="flex items-center gap-3 p-4 md:px-5"
              >
                <div
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                    commission.payment_status === 'paid'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-yellow-100 dark:bg-yellow-900/30',
                  )}
                >
                  {commission.payment_status === 'paid' ? (
                    <ArrowUpRight className="h-5 w-5 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {commission.customer_name}
                    </p>
                    <Badge
                      variant={
                        commission.payment_status === 'paid'
                          ? 'success'
                          : 'warning'
                      }
                      className="text-[10px]"
                    >
                      {commission.payment_status === 'paid' ? 'Paid' : 'Pending'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {commission.device_model} &middot; {commission.loan_id}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-green-600">
                    +${commission.commission_amount.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {commission.commission_percentage}% of $
                    {commission.device_retail_price}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(commission.calculation_date).toLocaleDateString(
                      'en-ZW',
                      { month: 'short', day: 'numeric' },
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
