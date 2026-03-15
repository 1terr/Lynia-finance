'use client';

import type { CustomerListParams } from '@/lib/api/customers';

interface CustomerFiltersProps {
  filters: CustomerListParams;
  onChange: (filters: Partial<CustomerListParams>) => void;
}

export function CustomerFilters({ filters, onChange }: CustomerFiltersProps) {
  return (
    <div className="flex gap-3">
      <select
        value={filters.status || ''}
        onChange={(e) =>
          onChange({
            status: (e.target.value || undefined) as CustomerListParams['status'],
          })
        }
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="blocked">Blocked</option>
      </select>

      <select
        value={filters.kyc_status || ''}
        onChange={(e) =>
          onChange({
            kyc_status: (e.target.value || undefined) as CustomerListParams['kyc_status'],
          })
        }
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">All KYC</option>
        <option value="pending">Pending</option>
        <option value="in_review">In Review</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>

      <select
        value={filters.credit_tier || ''}
        onChange={(e) =>
          onChange({
            credit_tier: e.target.value ? Number(e.target.value) : undefined,
          })
        }
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">All Tiers</option>
        <option value="1">Tier 1</option>
        <option value="2">Tier 2</option>
        <option value="3">Tier 3</option>
      </select>
    </div>
  );
}
