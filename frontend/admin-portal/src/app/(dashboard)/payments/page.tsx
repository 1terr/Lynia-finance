'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { SearchBar } from '@/components/shared/SearchBar';
import { PaymentFilters } from '@/components/payments/PaymentFilters';
import { PaymentTable } from '@/components/payments/PaymentTable';
import { PaymentSummaryCards } from '@/components/payments/PaymentSummaryCards';
import { RecordPaymentForm } from '@/components/payments/RecordPaymentForm';
import {
  fetchPayments,
  exportPaymentsToCSV,
  type PaymentListParams,
} from '@/lib/api/payments';

export default function PaymentsPage() {
  const [params, setParams] = useState<PaymentListParams>({
    page: 1,
    limit: 25,
  });
  const [showRecordForm, setShowRecordForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', params],
    queryFn: () => fetchPayments(params),
  });

  const handleExport = () => {
    if (!data?.payments.length) return;
    const csv = exportPaymentsToCSV(data.payments);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
          <p className="mt-2 text-gray-600">
            Manage payments, reconciliation, and collections
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/payments/collections"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Collections Queue
          </Link>
          <Link
            href="/dashboard/payments/reconciliation"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reconciliation
          </Link>
          <button
            onClick={() => setShowRecordForm(!showRecordForm)}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Record Payment
          </button>
          <button
            onClick={handleExport}
            disabled={!data?.payments.length}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <PaymentSummaryCards
        dateFrom={params.date_from}
        dateTo={params.date_to}
      />

      {showRecordForm && (
        <RecordPaymentForm onClose={() => setShowRecordForm(false)} />
      )}

      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <SearchBar
              placeholder="Search by reference, transaction ID, or phone..."
              onSearch={(query) =>
                setParams({ ...params, search: query, page: 1 })
              }
            />
          </div>
        </div>
        <PaymentFilters
          filters={params}
          onChange={(newFilters) =>
            setParams({ ...params, ...newFilters, page: 1 })
          }
        />
      </div>

      <PaymentTable
        payments={data?.payments || []}
        total={data?.total || 0}
        page={params.page}
        limit={params.limit}
        isLoading={isLoading}
        onPageChange={(page) => setParams({ ...params, page })}
      />
    </div>
  );
}
