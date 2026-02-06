'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchCollectionsQueue } from '@/lib/api/payments';
import { CollectionsQueue } from '@/components/payments/CollectionsQueue';
import { formatCurrency } from '@/lib/utils';

export default function CollectionsPage() {
  const { data: items, isLoading } = useQuery({
    queryKey: ['collections-queue'],
    queryFn: fetchCollectionsQueue,
    refetchInterval: 60000,
  });

  const totalDue = (items || []).reduce((sum, item) => sum + item.amount_due, 0);
  const criticalCount = (items || []).filter(
    (i) => i.priority === 'critical'
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/payments"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Payments
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-700">Collections</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Collections Queue
          </h1>
          <p className="mt-2 text-gray-600">
            Overdue loans sorted by priority for collections follow-up
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-gray-500">Total Overdue</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {formatCurrency(totalDue)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">
            Overdue Accounts
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {items?.length || 0}
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-gray-500">
            Critical (60+ days)
          </p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {criticalCount}
          </p>
        </div>
      </div>

      <CollectionsQueue items={items || []} isLoading={isLoading} />
    </div>
  );
}
