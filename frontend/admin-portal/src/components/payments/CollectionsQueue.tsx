'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { CollectionItem } from '@/lib/api/payments';

interface CollectionsQueueProps {
  items: CollectionItem[];
  isLoading: boolean;
}

const priorityMap: Record<string, { variant: 'destructive' | 'warning' | 'info' | 'gray'; label: string }> = {
  critical: { variant: 'destructive', label: 'Critical' },
  high: { variant: 'destructive', label: 'High' },
  medium: { variant: 'warning', label: 'Medium' },
  low: { variant: 'info', label: 'Low' },
};

export function CollectionsQueue({ items, isLoading }: CollectionsQueueProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg bg-white shadow">
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-gray-500">Loading collections queue...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-white p-12 text-center shadow">
        <div className="text-4xl">&#10003;</div>
        <p className="mt-4 text-lg font-medium text-gray-900">
          No overdue loans
        </p>
        <p className="mt-1 text-gray-500">
          All active loans are current on payments
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Priority
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Customer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Amount Due
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Days Overdue
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Missed
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Last Payment
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {items.map((item) => {
            const priorityInfo = priorityMap[item.priority] || priorityMap.low;
            return (
              <tr
                key={item.id}
                className={`hover:bg-gray-50 ${
                  item.priority === 'critical' ? 'bg-red-50' : ''
                }`}
              >
                <td className="whitespace-nowrap px-6 py-4">
                  <Badge variant={priorityInfo.variant}>
                    {priorityInfo.label}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <Link
                    href={`/customers/${item.customer_id}`}
                    className="text-sm font-medium text-primary-600 hover:underline"
                  >
                    {item.customer_name}
                  </Link>
                  <div className="text-xs text-gray-500">
                    {item.customer_phone}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-red-600">
                  {formatCurrency(item.amount_due)}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span
                    className={`text-sm font-medium ${
                      item.days_overdue >= 60
                        ? 'text-red-600'
                        : item.days_overdue >= 30
                          ? 'text-yellow-600'
                          : 'text-gray-900'
                    }`}
                  >
                    {item.days_overdue} days
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {item.missed_payments}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {item.last_payment_date
                    ? formatDate(item.last_payment_date)
                    : 'Never'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                  <Link
                    href={`/customers/${item.customer_id}`}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    View Customer
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
