'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/shared/Pagination';
import { formatDate, formatCurrency, truncateId, maskPhone } from '@lynia/utils';
import type { PaymentWithCustomer } from '@/lib/api/payments';

interface PaymentTableProps {
  payments: PaymentWithCustomer[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

const statusMap: Record<string, { variant: 'green' | 'yellow' | 'red' | 'gray'; label: string }> = {
  confirmed: { variant: 'green', label: 'Confirmed' },
  pending: { variant: 'yellow', label: 'Pending' },
  failed: { variant: 'red', label: 'Failed' },
  refunded: { variant: 'gray', label: 'Refunded' },
};

export function PaymentTable({
  payments,
  total,
  page,
  limit,
  isLoading,
  onPageChange,
}: PaymentTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg bg-white shadow">
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-gray-500">Loading payments...</p>
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-lg bg-white shadow">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-gray-500">No payments found</p>
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
              Payment
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Customer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Amount
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Method
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Date
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {payments.map((payment) => {
            const statusInfo = statusMap[payment.status] || statusMap.pending;
            return (
              <tr key={payment.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {truncateId(payment.id)}
                  </div>
                  <div className="text-xs capitalize text-gray-500">
                    {payment.payment_type.replace(/_/g, ' ')}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {payment.customers ? (
                    <div>
                      <Link
                        href={`/dashboard/customers/${payment.customer_id}`}
                        className="text-sm font-medium text-primary-600 hover:underline"
                      >
                        {payment.customers.first_name}{' '}
                        {payment.customers.last_name}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {maskPhone(payment.customers.phone_number)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">
                      {truncateId(payment.customer_id)}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {formatCurrency(payment.amount_usd)}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="text-sm capitalize text-gray-700">
                    {payment.payment_method.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <Badge variant={statusInfo.variant}>
                    {statusInfo.label}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {formatDate(payment.payment_date)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <Link
                    href={`/dashboard/payments/${payment.id}`}
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
