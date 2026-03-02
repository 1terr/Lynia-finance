'use client';

import { useQuery } from '@tanstack/react-query';
import type { DashboardStats } from '@/types/distributor';
import { fetchDashboardStats, fetchCompletedHandovers } from '@/lib/api';
import { cn } from '@lynia/utils';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import {
  PackageCheck,
  Smartphone,
  DollarSign,
  Star,
  Plus,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardHome() {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['distributor', 'stats'],
    queryFn: fetchDashboardStats,
  });

  const { data: recentHandovers = [], isLoading: handoversLoading, isError: handoversError, refetch: refetchHandovers } = useQuery({
    queryKey: ['distributor', 'handovers', 'completed'],
    queryFn: fetchCompletedHandovers,
  });

  const loading = statsLoading || handoversLoading;
  const hasError = statsError || handoversError;

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (hasError || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <PackageCheck className="h-6 w-6 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Failed to load dashboard</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Could not fetch your dashboard data. Please try again.
        </p>
        <button
          onClick={() => { refetchStats(); refetchHandovers(); }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const isNewDistributor =
    stats.total_devices_distributed === 0 &&
    stats.total_commissions_earned === 0 &&
    stats.current_inventory === 0;

  const recentFive = recentHandovers.slice(0, 5);
  const monthlyDiff = stats.monthly_handovers - stats.last_month_handovers;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold md:text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your distribution activity</p>
      </div>

      {/* Getting started banner for new distributors */}
      {isNewDistributor && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-5">
          <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Welcome to Lynia</h2>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Your distributor account is set up. Once inventory is assigned and handovers begin, your stats will appear here.
          </p>
        </div>
      )}

      {/* Start Handover CTA */}
      <Link
        href="/handovers"
        className="flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 hover:bg-primary/10 transition-colors"
      >
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Plus className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">Start New Handover</p>
          <p className="text-xs text-muted-foreground">Search for a customer with an approved loan</p>
        </div>
        <ArrowRight className="h-4 w-4 text-primary ml-auto" />
      </Link>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <PackageCheck className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-muted-foreground">Devices Distributed</span>
          </div>
          <p className="text-2xl font-bold">{stats.total_devices_distributed}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-muted-foreground">{stats.monthly_handovers} this month</span>
            {monthlyDiff !== 0 && (
              <span className={cn(
                'text-xs font-medium',
                monthlyDiff > 0 ? 'text-green-600' : 'text-red-500',
              )}>
                {monthlyDiff > 0 ? '+' : ''}{monthlyDiff} vs last
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="h-4 w-4 text-cyan-600" />
            <span className="text-xs font-medium text-muted-foreground">In Inventory</span>
          </div>
          <p className="text-2xl font-bold">{stats.current_inventory}</p>
          <p className="text-xs text-muted-foreground mt-1">devices available</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-muted-foreground">Total Earned</span>
          </div>
          <p className="text-2xl font-bold text-green-600">${stats.total_commissions_earned.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">in commissions</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-xs font-medium text-muted-foreground">Rating</span>
          </div>
          <p className="text-2xl font-bold">{stats.average_rating.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">out of 5.0</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/handovers" className="rounded-xl border bg-card p-3 shadow-sm hover:bg-muted/50 transition-colors text-center">
          <PackageCheck className="h-5 w-5 text-primary mx-auto mb-1" />
          <span className="text-xs font-medium">Start Handover</span>
        </Link>
        <Link href="/inventory" className="rounded-xl border bg-card p-3 shadow-sm hover:bg-muted/50 transition-colors text-center">
          <Smartphone className="h-5 w-5 text-cyan-600 mx-auto mb-1" />
          <span className="text-xs font-medium">Check Inventory</span>
        </Link>
        <Link href="/commissions" className="rounded-xl border bg-card p-3 shadow-sm hover:bg-muted/50 transition-colors text-center">
          <DollarSign className="h-5 w-5 text-green-600 mx-auto mb-1" />
          <span className="text-xs font-medium">View Earnings</span>
        </Link>
      </div>

      {/* Commission summary */}
      <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Commission Summary</h2>
          <Link href="/commissions" className="text-xs text-primary font-medium flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Earned</p>
            <p className="text-lg font-bold text-green-600">${stats.total_commissions_earned.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid Out</p>
            <p className="text-lg font-bold">${stats.total_commissions_paid.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-bold text-yellow-600">${stats.pending_commissions.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Recent handovers */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between p-4 md:p-5 border-b">
          <h2 className="text-sm font-semibold">Recent Handovers</h2>
          <Link href="/handovers" className="text-xs text-primary font-medium flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y">
          {recentFive.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No completed handovers yet
            </div>
          ) : (
            recentFive.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-4 md:px-5">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{h.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{h.device_model} &middot; {h.loan_id}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold">${h.loan_amount}</p>
                  <p className="text-xs font-medium text-green-600">+${h.commission_earned.toFixed(2)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
