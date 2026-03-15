'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/shared/Pagination';
import { formatDate, formatCurrency, truncateId, maskPhone } from '@lynia/utils';
import type { Customer } from '@/types/database';

interface CustomerTableProps {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

const kycStatusMap: Record<string, { variant: 'green' | 'yellow' | 'blue' | 'red' | 'gray'; label: string }> = {
  approved: { variant: 'green', label: 'Verified' },
  pending: { variant: 'yellow', label: 'Pending' },
  in_review: { variant: 'blue', label: 'In Review' },
  rejected: { variant: 'red', label: 'Rejected' },
  expired: { variant: 'gray', label: 'Expired' },
};

const tierColors: Record<number, 'blue' | 'purple' | 'gold'> = {
  1: 'blue',
  2: 'purple',
  3: 'gold',
};

export function CustomerTable({
  customers,
  total,
  page,
  limit,
  isLoading,
  onPageChange,
}: CustomerTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg bg-card shadow">
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading customers...</div>
        </div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-lg bg-card shadow">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No customers found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-card shadow">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Customer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              KYC Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Credit Tier
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Loans
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Joined
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {customers.map((customer) => {
            const kycInfo = kycStatusMap[customer.kyc_status] || kycStatusMap.pending;
            return (
              <tr key={customer.id} className="hover:bg-accent">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100">
                      <span className="text-sm font-medium text-primary-600">
                        {customer.first_name?.[0]}
                        {customer.last_name?.[0]}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-foreground">
                        {customer.first_name} {customer.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {truncateId(customer.id)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="text-sm text-foreground">
                    {maskPhone(customer.phone_number)}
                  </div>
                  {customer.email && (
                    <div className="text-xs text-muted-foreground">{customer.email}</div>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <Badge variant={kycInfo.variant}>{kycInfo.label}</Badge>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <Badge variant={tierColors[customer.credit_tier] || 'gray'}>
                    Tier {customer.credit_tier}
                  </Badge>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatCurrency(customer.credit_limit)} limit
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                  {customer.active_loans} active
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {formatDate(customer.created_at)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <Link
                    href={`/dashboard/customers/${customer.id}`}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  );
}
