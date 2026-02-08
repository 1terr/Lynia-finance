'use client';

import { formatCurrency } from '@/lib/utils';
import type { CustomerWithRelations } from '@/types/database';

interface CustomerOverviewProps {
  customer: CustomerWithRelations;
}

export function CustomerOverview({ customer }: CustomerOverviewProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-gray-900">Overview</h2>

      <div className="mt-4 grid grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500">
            Personal Information
          </h3>
          <InfoRow label="Date of Birth" value={customer.date_of_birth || 'N/A'} />
          <InfoRow label="Gender" value={customer.gender || 'N/A'} />
          <InfoRow
            label="Address"
            value={
              [customer.address_line_1, customer.city, customer.province]
                .filter(Boolean)
                .join(', ') || 'N/A'
            }
          />
        </div>

        {/* Employment */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500">Employment</h3>
          <InfoRow
            label="Status"
            value={customer.employment_status?.replace('_', ' ') || 'N/A'}
          />
          <InfoRow label="Type" value={customer.employment_type || 'N/A'} />
          <InfoRow
            label="Monthly Income"
            value={
              customer.monthly_income_usd
                ? formatCurrency(customer.monthly_income_usd)
                : 'N/A'
            }
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard label="Total Loans" value={customer.total_loans} />
        <StatCard label="Active Loans" value={customer.active_loans} />
        <StatCard
          label="Total Borrowed"
          value={formatCurrency(customer.total_borrowed)}
        />
        <StatCard
          label="Total Repaid"
          value={formatCurrency(customer.total_repaid)}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
