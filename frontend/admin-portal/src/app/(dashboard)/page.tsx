'use client';

import { useAuthStore } from '@/lib/store/auth-store';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.first_name ?? 'Admin'}. Here&apos;s your overview.
        </p>
      </div>

      {/* KPI Grid - placeholder for P3-T002 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active Loans', value: '--', change: '--' },
          { label: 'Total Disbursed', value: '--', change: '--' },
          { label: 'Outstanding Balance', value: '--', change: '--' },
          { label: 'Collection Rate', value: '--', change: '--' },
          { label: 'Default Rate', value: '--', change: '--' },
          { label: 'Active Customers', value: '--', change: '--' },
          { label: 'Devices Assigned', value: '--', change: '--' },
          { label: 'Pending KYC', value: '--', change: '--' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border bg-card p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">
              {kpi.label}
            </p>
            <p className="mt-2 text-2xl font-bold">{kpi.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.change}</p>
          </div>
        ))}
      </div>

      {/* Placeholder sections for P3-T002 */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Loan Disbursements</h2>
          <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
            Chart will be implemented in P3-T002
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
            Activity feed will be implemented in P3-T002
          </div>
        </div>
      </div>
    </div>
  );
}
