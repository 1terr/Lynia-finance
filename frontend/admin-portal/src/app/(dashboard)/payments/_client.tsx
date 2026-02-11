'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getPayments, getPaymentStats, type PaymentFilters, type PaymentWithRelations } from '@/lib/api/payments';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatCurrencyDetailed, formatDate } from '@/lib/utils';
import type { PaymentStatus, PaymentMethod, PaymentType } from '@/types';
import { Search, DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

const METHOD_OPTIONS = [
  { value: '', label: 'All Methods' },
  { value: 'ecocash', label: 'EcoCash' },
  { value: 'onemoney', label: 'OneMoney' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'installment', label: 'Installment' },
  { value: 'late_fee', label: 'Late Fee' },
  { value: 'early_payoff', label: 'Early Payoff' },
];

const RECONCILED_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export default function PaymentsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<PaymentFilters>({ page: 1, limit: 25 });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['payments', filters],
    queryFn: () => getPayments(filters),
  });

  const { data: stats } = useQuery({
    queryKey: ['payment-stats'],
    queryFn: () => getPaymentStats(),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput || undefined, page: 1 }));
  }

  const columns: Column<PaymentWithRelations>[] = [
    {
      key: 'payment_date',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="text-gray-500">{formatDate(row.payment_date)}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.customer?.full_name || 'Unknown'}</p>
          <p className="text-xs text-gray-500">{row.customer?.phone_number}</p>
        </div>
      ),
    },
    {
      key: 'amount_usd',
      header: 'Amount',
      sortable: true,
      render: (row) => (
        <span className="font-medium">{formatCurrencyDetailed((row as Record<string, unknown>).amount_usd as number || 0)}</span>
      ),
    },
    {
      key: 'payment_type',
      header: 'Type',
      render: (row) => (
        <span className="capitalize">{row.payment_type.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Method',
      render: (row) => (
        <span className="capitalize">{row.payment_method.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const payStatus = (row as Record<string, unknown>).status as string || '';
        return (
          <Badge variant="status" status={payStatus}>
            {payStatus}
          </Badge>
        );
      },
    },
    {
      key: 'reconciled',
      header: 'Reconciled',
      render: (row) =>
        row.reconciled ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <span className="text-gray-300">&mdash;</span>
        ),
    },
    {
      key: 'reference_number',
      header: 'Reference',
      render: (row) => (
        <span className="font-mono text-xs text-gray-500">
          {row.reference_number || (row as Record<string, unknown>).transaction_id as string || '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500">
            Track payments, reconciliation, and refunds.
          </p>
        </div>
        {data && (
          <p className="text-sm text-gray-500">{data.total} total payments</p>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Collected</p>
                <p className="text-lg font-semibold">{formatCurrencyDetailed(stats.total_collected)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-50 p-2">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-lg font-semibold">{stats.pending_count}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Failed</p>
                <p className="text-lg font-semibold">{stats.failed_count}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Unreconciled</p>
                <p className="text-lg font-semibold">{stats.unreconciled_count}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by reference number..."
            className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </form>
        <Select
          options={STATUS_OPTIONS}
          value={filters.status || ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              status: (e.target.value || undefined) as PaymentStatus | undefined,
              page: 1,
            }))
          }
          className="w-full sm:w-40"
        />
        <Select
          options={METHOD_OPTIONS}
          value={filters.method || ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              method: (e.target.value || undefined) as PaymentMethod | undefined,
              page: 1,
            }))
          }
          className="w-full sm:w-40"
        />
        <Select
          options={TYPE_OPTIONS}
          value={filters.type || ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              type: (e.target.value || undefined) as PaymentType | undefined,
              page: 1,
            }))
          }
          className="w-full sm:w-36"
        />
        <Select
          options={RECONCILED_OPTIONS}
          value={filters.reconciled === undefined ? '' : String(filters.reconciled)}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              reconciled: e.target.value === '' ? undefined : e.target.value === 'true',
              page: 1,
            }))
          }
          className="w-full sm:w-36"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => router.push(`/payments/${row.id}`)}
        loading={isLoading}
        emptyMessage="No payments found"
      />

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.total_pages}
          total={data.total}
          pageSize={data.limit}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
        />
      )}
    </div>
  );
}
