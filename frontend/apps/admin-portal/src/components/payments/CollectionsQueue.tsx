'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatCurrency, formatDate, maskPhone } from '@lynia/utils';
import type { CollectionItem } from '@/lib/api/payments';

interface CollectionsQueueProps {
  items: CollectionItem[];
  isLoading: boolean;
}

const priorityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const priorityMap: Record<string, { variant: 'red' | 'yellow' | 'blue' | 'gray'; label: string; icon: string }> = {
  critical: { variant: 'red', label: 'Critical', icon: '!!' },
  high: { variant: 'red', label: 'High', icon: '!' },
  medium: { variant: 'yellow', label: 'Medium', icon: '-' },
  low: { variant: 'blue', label: 'Low', icon: '' },
};

type SortField = 'priority' | 'days_overdue' | 'amount_due';

export function CollectionsQueue({ items, isLoading }: CollectionsQueueProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('priority');
  const debouncedSearch = useDebouncedValue(search);

  const processedItems = useMemo(() => {
    let result = [...items];

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (item) =>
          item.customer_name.toLowerCase().includes(query) ||
          item.customer_phone.includes(query)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99) || b.days_overdue - a.days_overdue;
        case 'days_overdue':
          return b.days_overdue - a.days_overdue;
        case 'amount_due':
          return b.amount_due - a.amount_due;
        default:
          return 0;
      }
    });

    return result;
  }, [items, debouncedSearch, sortBy]);

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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name or phone..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-72"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Sort by:</span>
          {([
            { key: 'priority' as const, label: 'Priority' },
            { key: 'days_overdue' as const, label: 'Days Overdue' },
            { key: 'amount_due' as const, label: 'Amount' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                sortBy === key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {processedItems.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow">
          <p className="text-sm text-gray-500">
            No collections match your search.
          </p>
        </div>
      ) : (
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
              {processedItems.map((item) => {
                const priorityInfo = priorityMap[item.priority] || priorityMap.low;
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 ${
                      item.priority === 'critical' ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={priorityInfo.variant}>
                          {priorityInfo.label}
                        </Badge>
                        {item.priority === 'critical' && (
                          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/dashboard/customers/${item.customer_id}`}
                        className="text-sm font-medium text-primary-600 hover:underline"
                      >
                        {item.customer_name}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {maskPhone(item.customer_phone)}
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
                        href={`/dashboard/customers/${item.customer_id}`}
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
      )}
    </div>
  );
}
