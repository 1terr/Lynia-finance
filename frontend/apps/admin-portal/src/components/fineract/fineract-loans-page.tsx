'use client';

/**
 * Fineract Loan Portfolio Page (Phase 7 - T005)
 *
 * Displays loans with real-time balances from Fineract core banking engine.
 * Replaces the legacy loans page with Fineract-sourced data.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getFineractLoans, type FineractLoanFilters } from '@/lib/api/fineract';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@lynia/utils';
import { getFineractStatusDisplay, type FineractLoanView, type FineractLoanStatusCode } from '@/types/fineract';
import { Search, Building2, X, Download } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'loanStatusType.submittedAndPendingApproval', label: 'Pending Approval' },
  { value: 'loanStatusType.approved', label: 'Approved' },
  { value: 'loanStatusType.active', label: 'Active' },
  { value: 'loanStatusType.closed.obligations.met', label: 'Closed (Paid)' },
  { value: 'loanStatusType.closed.written.off', label: 'Written Off' },
  { value: 'loanStatusType.defaulted', label: 'Defaulted' },
  { value: 'loanStatusType.cancelled', label: 'Cancelled' },
  { value: 'loanStatusType.rejected', label: 'Rejected' },
];

export default function FineractLoansPage() {
  const router = useRouter();
  const [status, setStatus] = useState<FineractLoanStatusCode | undefined>();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebouncedValue(searchInput);

  const filters = useMemo<FineractLoanFilters>(
    () => ({
      page,
      limit: 25,
      status,
      search: debouncedSearch || undefined,
    }),
    [page, status, debouncedSearch]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['fineract-loans', filters],
    queryFn: () => getFineractLoans(filters),
    refetchInterval: 30000,
  });

  const columns: Column<FineractLoanView>[] = [
    {
      key: 'fineractAccountNo',
      header: 'Account',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-muted-foreground">
            {row.fineractAccountNo}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span>Loan #{row.fineractLoanId}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.customerName}</p>
          <p className="text-xs text-muted-foreground">{row.customerPhone}</p>
        </div>
      ),
    },
    {
      key: 'productName',
      header: 'Product',
      render: (row) => (
        <span className="text-sm text-foreground">
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
          <p className="text-xs text-muted-foreground">
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
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'submittedOnDate',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-muted-foreground">
          {row.submittedOnDate ? formatDate(row.submittedOnDate) : '-'}
        </span>
      ),
    },
  ];

  const exportCsv = useCallback((loans: FineractLoanView[]) => {
    const headers = ['Account', 'Customer', 'Phone', 'Product', 'Principal', 'Outstanding', 'Overdue', 'Status', 'Device', 'Date'];
    const rows = loans.map((row) => [
      row.fineractAccountNo,
      row.customerName,
      row.customerPhone || '',
      row.productName.replace('Lynia Device Finance - ', ''),
      row.principal,
      row.totalOutstanding,
      row.totalOverdue,
      getFineractStatusDisplay(row.status.code).label,
      row.deviceBrand ? `${row.deviceBrand} ${row.deviceModel}` : '',
      row.submittedOnDate || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loans-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Loan Portfolio</h1>
          <p className="text-sm text-muted-foreground">
            Real-time loan portfolio data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <p className="text-sm text-muted-foreground">{data.total} total loans</p>
          )}
          <button
            onClick={() => exportCsv(data?.data || [])}
            disabled={!data?.data?.length}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-accent disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, phone, loan number, or national ID..."
            className="block w-full rounded-md border border-border py-2 pl-10 pr-8 text-sm shadow-sm placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-border dark:bg-card dark:text-foreground"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          options={STATUS_OPTIONS}
          value={status || ''}
          onChange={(e) => {
            setStatus(
              (e.target.value || undefined) as FineractLoanStatusCode | undefined
            );
            setPage(1);
          }}
          className="w-full sm:w-52"
        />
      </div>

      {/* Selection toolbar */}
      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2">
          <span className="text-sm font-medium text-brand-700">
            {selectedKeys.size} selected
          </span>
          <button
            onClick={() => {
              const selected = (data?.data || []).filter((r) => selectedKeys.has(r.lyniaLoanId));
              exportCsv(selected);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
          >
            <Download className="h-3.5 w-3.5" />
            Export Selected
          </button>
          <button
            onClick={() => setSelectedKeys(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        keyExtractor={(row) => row.lyniaLoanId}
        onRowClick={(row) => router.push(`/loans/${row.lyniaLoanId}/fineract`)}
        loading={isLoading}
        emptyMessage="No loans found"
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
      />

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.total_pages}
          total={data.total}
          pageSize={data.limit}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
