'use client';

import {
  Users,
  Banknote,
  Smartphone,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/context';

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down';
  icon: React.ReactNode;
}

function MetricCard({ title, value, change, trend, icon }: MetricCardProps) {
  return (
    <div className="card flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        {change && (
          <div className="mt-2 flex items-center gap-1">
            {trend === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span
              className={cn(
                'text-sm font-medium',
                trend === 'up' ? 'text-green-600' : 'text-red-600'
              )}
            >
              {change}
            </span>
            <span className="text-sm text-gray-400">vs last month</span>
          </div>
        )}
      </div>
      <div className="rounded-lg bg-brand-50 p-3">{icon}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {user?.full_name ?? 'Admin'}. Here&apos;s what&apos;s
          happening today.
        </p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Customers"
          value="--"
          icon={<Users className="h-6 w-6 text-brand-600" />}
        />
        <MetricCard
          title="Active Loans"
          value="--"
          icon={<Banknote className="h-6 w-6 text-brand-600" />}
        />
        <MetricCard
          title="Devices in Stock"
          value="--"
          icon={<Smartphone className="h-6 w-6 text-brand-600" />}
        />
        <MetricCard
          title="Payments Today"
          value="--"
          icon={<CreditCard className="h-6 w-6 text-brand-600" />}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">
            Pending Actions
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Items requiring your attention
          </p>
          <div className="mt-4 space-y-3">
            <ActionItem
              label="KYC reviews awaiting approval"
              count={0}
              href="/customers/kyc-review"
            />
            <ActionItem
              label="Loan applications pending"
              count={0}
              href="/loans/pending-approval"
            />
            <ActionItem
              label="Device handovers scheduled"
              count={0}
              href="/devices/handovers"
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Activity
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Latest operations on the platform
          </p>
          <div className="mt-4 flex items-center justify-center py-8 text-sm text-gray-400">
            No recent activity to display
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionItem({
  label,
  count,
  href,
}: {
  label: string;
  count: number;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
          {count}
        </span>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <ArrowRight className="h-4 w-4 text-gray-400" />
    </a>
  );
}
