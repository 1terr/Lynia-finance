'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/shared/Pagination';
import { formatDate, formatCurrency, truncateId, maskPhone } from '@/lib/utils';
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
      <div className="rounded-lg bg-white shadow">
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-gray-500">Loading customers...</div>
        </div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-lg bg-white shadow">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-gray-500">No customers found</p>
            <p className="mt-1 text-xs text-gray-400">
              Try adjusting your search or filters
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Customer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              KYC Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Credit Tier
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Loans
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Joined
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {customers.map((customer) => {
            const kycInfo = kycStatusMap[customer.kyc_status] || kycStatusMap.pending;
            return (
              <tr key={customer.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100">
                      <span className="text-sm font-medium text-primary-600">
                        {customer.first_name?.[0]}
                        {customer.last_name?.[0]}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {customer.first_name} {customer.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {truncateId(customer.id)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {maskPhone(customer.phone_number)}
                  </div>
                  {customer.email && (
                    <div className="text-xs text-gray-500">{customer.email}</div>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <Badge variant={kycInfo.variant}>{kycInfo.label}</Badge>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <Badge variant={tierColors[customer.credit_tier] || 'gray'}>
                    Tier {customer.credit_tier}
                  </Badge>
                  <div className="mt-1 text-xs text-gray-500">
                    {formatCurrency(customer.credit_limit)} limit
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {customer.active_loans} active
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
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
