'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getLoans, type LoanFilters, type LoanWithCustomer } from '@/lib/api/loans';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { LoanStatus } from '@/types';
import { Search } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'paid_off', label: 'Paid Off' },
  { value: 'defaulted', label: 'Defaulted' },
  { value: 'rejected', label: 'Rejected' },
];

export default function LoansPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<LoanFilters>({ page: 1, limit: 25 });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['loans', filters],
    queryFn: () => getLoans(filters),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput || undefined, page: 1 }));
  }

  const columns: Column<LoanWithCustomer>[] = [
    {
      key: 'id',
      header: 'Loan ID',
      render: (row) => (
        <span className="font-mono text-xs text-gray-500">{row.id.slice(0, 8)}...</span>
      ),
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
      key: 'loan_amount_usd',
      header: 'Amount',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium">{formatCurrency(row.loan_amount_usd)}</p>
          <p className="text-xs text-gray-500">{row.loan_term_months}mo @ {row.interest_rate}%</p>
        </div>
      ),
    },
    {
      key: 'outstanding_balance_usd',
      header: 'Outstanding',
      sortable: true,
      render: (row) => formatCurrency(row.outstanding_balance_usd),
    },
    {
      key: 'loan_status',
      header: 'Status',
      render: (row) => (
        <Badge variant="status" status={row.loan_status}>
          {row.loan_status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'days_past_due',
      header: 'DPD',
      sortable: true,
      render: (row) => (
        <span className={row.days_past_due > 0 ? 'font-medium text-red-600' : 'text-gray-500'}>
          {row.days_past_due > 0 ? `${row.days_past_due}d` : '-'}
        </span>
      ),
    },
    {
      key: 'device',
      header: 'Device',
      render: (row) =>
        row.device ? (
          <span className="text-sm">{row.device.device_brand} {row.device.device_model}</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="text-gray-500">{formatDate(row.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loans</h1>
          <p className="text-sm text-gray-500">
            Manage loan applications, approvals, and portfolio tracking.
          </p>
        </div>
        {data && (
          <p className="text-sm text-gray-500">{data.total} total loans</p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by loan ID or customer name..."
            className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </form>
        <Select
          options={STATUS_OPTIONS}
          value={filters.status || ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              status: (e.target.value || undefined) as LoanStatus | undefined,
              page: 1,
            }))
          }
          className="w-full sm:w-44"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => router.push(`/loans/${row.id}`)}
        loading={isLoading}
        emptyMessage="No loans found"
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
