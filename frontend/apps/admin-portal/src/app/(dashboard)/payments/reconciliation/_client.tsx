'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchUnreconciledPayments } from '@/lib/api/payments';
import { ReconciliationTable } from '@/components/payments/ReconciliationTable';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RefreshCw } from 'lucide-react';

export default function ReconciliationPage() {
  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ['unreconciled-payments'],
    queryFn: fetchUnreconciledPayments,
    refetchInterval: 30000,
  });

  return (
    <ProtectedRoute requiredPermission={{ resource: 'payments', action: 'reconcile' }}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/payments"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Payments
              </Link>
              <span className="text-gray-300">/</span>
              <span className="text-sm text-gray-700">Reconciliation</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">
              Payment Reconciliation
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Review and reconcile confirmed payments with gateway records
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {payments?.length || 0}
              </div>
              <div className="text-sm text-gray-500">Unreconciled</div>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <ReconciliationTable
          payments={payments || []}
          isLoading={isLoading}
        />
      </div>
    </ProtectedRoute>
  );
}
