'use client';

/**
 * Fineract Loan Portfolio Page (Phase 7 - T005)
 *
 * Displays loans with real-time balances from Fineract core banking engine.
 * Replaces the legacy loans page with Fineract-sourced data.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getFineractLoans, type FineractLoanFilters } from '@/lib/api/fineract';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@lynia/utils';
import { getFineractStatusDisplay, type FineractLoanView, type FineractLoanStatusCode } from '@/types/fineract';
import { Search, Building2 } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'loanStatusType.submittedAndPendingApproval', label: 'Pending Approval' },
  { value: 'loanStatusType.approved', label: 'Approved' },
  { value: 'loanStatusType.active', label: 'Active' },
  { value: 'loanStatusType.closed.obligations.met', label: 'Closed (Paid)' },
  { value: 'loanStatusType.closed.written.off', label: 'Written Off' },
  { value: 'loanStatusType.rejected', label: 'Rejected' },
];

export default function FineractLoansPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<FineractLoanFilters>({
    page: 1,
    limit: 25,
  });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['fineract-loans', filters],
    queryFn: () => getFineractLoans(filters),
    refetchInterval: 30000,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput || undefined, page: 1 }));
  }

  const columns: Column<FineractLoanView>[] = [
    {
      key: 'fineractAccountNo',
      header: 'Account',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-gray-500">
            {row.fineractAccountNo}
          </span>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Building2 className="h-3 w-3" />
            <span>Fineract #{row.fineractLoanId}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.customerName}</p>
          <p className="text-xs text-gray-500">{row.customerPhone}</p>
        </div>
      ),
    },
    {
      key: 'productName',
      header: 'Product',
      render: (row) => (
        <span className="text-sm text-gray-700">
          {row.productName.replace('Lynia Device Finance - ', '')}
        </span>
      ),
    },
    {
      key: 'principal',
      header: 'Principal',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium">{formatCurrency(row.principal)}</p>
          <p className="text-xs text-gray-500">
            {row.numberOfRepayments}mo @ {row.interestRatePerPeriod}%
          </p>
        </div>
      ),
    },
    {
      key: 'totalOutstanding',
      header: 'Outstanding',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium">{formatCurrency(row.totalOutstanding)}</p>
          {row.totalOverdue > 0 && (
            <p className="text-xs font-medium text-red-600">
              {formatCurrency(row.totalOverdue)} overdue
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const display = getFineractStatusDisplay(row.status.code);
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${display.bgColor} ${display.color}`}
          >
            {display.label}
          </span>
        );
      },
    },
    {
      key: 'device',
      header: 'Device',
      render: (row) =>
        row.deviceBrand ? (
          <span className="text-sm">
            {row.deviceBrand} {row.deviceModel}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'submittedOnDate',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-gray-500">
          {row.submittedOnDate ? formatDate(row.submittedOnDate) : '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Portfolio</h1>
          <p className="text-sm text-gray-500">
            Real-time loan data from Fineract core banking engine.
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
              status: (e.target.value || undefined) as
                | FineractLoanStatusCode
                | undefined,
              page: 1,
            }))
          }
          className="w-full sm:w-52"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        keyExtractor={(row) => row.lyniaLoanId}
        onRowClick={(row) => router.push(`/loans/${row.lyniaLoanId}/fineract`)}
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
