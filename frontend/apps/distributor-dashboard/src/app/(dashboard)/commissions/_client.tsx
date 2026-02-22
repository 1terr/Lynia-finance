'use client';

import { useEffect, useState, useMemo } from 'react';
import type { CommissionEntry, DashboardStats } from '@/types/distributor';
import { fetchCommissions, fetchDashboardStats } from '@/lib/api/distributor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@lynia/utils';
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

function exportCSV(commissions: CommissionEntry[]) {
  const header = 'Date,Loan ID,Device,Customer,Price,Rate,Commission,Status,Paid At\n';
  const rows = commissions
    .map(
      (c) =>
        `${c.calculation_date},${c.loan_id},${c.device_model},${c.customer_name},${c.device_retail_price},${c.commission_percentage}%,$${c.commission_amount.toFixed(2)},${c.payment_status},${c.paid_at || '-'}`
    )
    .join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `commissions_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<CommissionEntry[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  useEffect(() => {
    Promise.all([fetchCommissions(), fetchDashboardStats()]).then(
      ([comms, s]) => {
        setCommissions(comms);
        setStats(s);
        setLoading(false);
      }
    );
  }, []);

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

  const handoverCount = commissions.length;

  if (loading || !stats) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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

      {/* Performance tier */}
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
                    : 'bg-orange-500'
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
            <p className="text-lg font-bold">5%</p>
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
                1
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {(['all', 'paid', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPaymentFilter(f)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                paymentFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {f === 'all' ? 'All' : f === 'paid' ? 'Paid' : 'Pending'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border p-1">
          {(['all', 'this_month', 'last_month'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPeriodFilter(f)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                periodFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
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
                      : 'bg-yellow-100 dark:bg-yellow-900/30'
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
                      { month: 'short', day: 'numeric' }
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
