'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCustomers, type CustomerFilters } from '@/lib/api/customers';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Customer, CustomerStatus, KYCStatus } from '@/types';
import { Search } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blocked', label: 'Blocked' },
];

const KYC_OPTIONS = [
  { value: '', label: 'All KYC' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

export default function CustomersPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<CustomerFilters>({ page: 1, limit: 25 });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers', filters],
    queryFn: () => getCustomers(filters),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput || undefined, page: 1 }));
  }

  const columns: Column<Customer>[] = [
    {
      key: 'full_name',
      header: 'Customer',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.full_name}</p>
          <p className="text-xs text-gray-500">{row.phone_number}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => (
        <span className="text-gray-500">{row.email || '-'}</span>
      ),
    },
    {
      key: 'kyc_status',
      header: 'KYC',
      render: (row) => (
        <Badge variant="status" status={row.kyc_status}>
          {row.kyc_status}
        </Badge>
      ),
    },
    {
      key: 'credit_score',
      header: 'Credit Score',
      sortable: true,
      render: (row) => (
        <span className={row.credit_score ? 'font-medium' : 'text-gray-400'}>
          {row.credit_score || '-'}
        </span>
      ),
    },
    {
      key: 'monthly_income_usd',
      header: 'Income',
      sortable: true,
      render: (row) => (
        <span>{row.monthly_income_usd ? formatCurrency(row.monthly_income_usd) : '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant="status" status={row.status}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      sortable: true,
      render: (row) => <span className="text-gray-500">{formatDate(row.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">
            Manage customer profiles, KYC status, and credit history.
          </p>
        </div>
        {data && (
          <p className="text-sm text-gray-500">{data.total} total customers</p>
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
            placeholder="Search by name, phone, or email..."
            className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </form>
        <Select
          options={STATUS_OPTIONS}
          value={filters.status || ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              status: (e.target.value || undefined) as CustomerStatus | undefined,
              page: 1,
            }))
          }
          className="w-full sm:w-36"
        />
        <Select
          options={KYC_OPTIONS}
          value={filters.kyc_status || ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              kyc_status: (e.target.value || undefined) as KYCStatus | undefined,
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
        onRowClick={(row) => router.push(`/customers/${row.id}`)}
        loading={isLoading}
        emptyMessage="No customers found"
      />

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
