'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchUnreconciledPayments } from '@/lib/api/payments';
import { ReconciliationTable } from '@/components/payments/ReconciliationTable';

export default function ReconciliationPage() {
  const { data: payments, isLoading } = useQuery({
    queryKey: ['unreconciled-payments'],
    queryFn: fetchUnreconciledPayments,
    refetchInterval: 30000,
  });

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
            <span className="text-sm text-gray-700">Reconciliation</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Payment Reconciliation
          </h1>
          <p className="mt-2 text-gray-600">
            Review and reconcile confirmed payments with gateway records
          </p>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {payments?.length || 0}
          </div>
          <div className="text-sm text-gray-500">Unreconciled</div>
        </div>
      </div>

      <ReconciliationTable
        payments={payments || []}
        isLoading={isLoading}
      />
    </div>
  );
}
