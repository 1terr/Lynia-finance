'use client';

import { useQuery } from '@tanstack/react-query';
import type { DashboardStats, PendingHandover } from '@/types/distributor';
import { fetchDashboardStats, fetchPendingHandovers } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { cn } from '@lynia/utils';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import {
  PackageCheck,
  Smartphone,
  DollarSign,
  Star,
  TrendingUp,
  Clock,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardHome() {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['distributor', 'stats'],
    queryFn: fetchDashboardStats,
  });

  const { data: handovers = [], isLoading: handoversLoading, isError: handoversError, refetch: refetchHandovers } = useQuery({
    queryKey: ['distributor', 'handovers', 'initiated'],
    queryFn: fetchPendingHandovers,
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

      {/* Stats grid - mobile 2 cols, desktop 4 cols */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <PackageCheck className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-muted-foreground">Devices Distributed</span>
          </div>
          <p className="text-2xl font-bold">{stats.total_devices_distributed}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.monthly_handovers} this month</p>
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
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-xs font-medium text-muted-foreground">Pending Handovers</span>
          </div>
          <p className="text-2xl font-bold">{stats.pending_handovers}</p>
          <p className="text-xs text-muted-foreground mt-1">need action</p>
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

      {/* Pending handovers */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between p-4 md:p-5 border-b">
          <h2 className="text-sm font-semibold">Upcoming Handovers</h2>
          <Link href="/handovers" className="text-xs text-primary font-medium flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y">
          {handovers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No pending handovers</div>
          ) : (
            handovers.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-4 md:px-5">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <PackageCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{h.customer_name}</p>
                    <Badge variant={h.deposit_paid ? 'success' : 'warning'} className="text-[10px]">
                      {h.deposit_paid ? 'Deposit Paid' : 'Deposit Pending'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{h.device_model} &middot; {h.loan_id}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold">${h.loan_amount}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(h.scheduled_date).toLocaleDateString('en-ZW', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
