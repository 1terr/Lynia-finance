'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getOrganizations } from '@/lib/api/products';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { formatDate, formatNumber } from '@lynia/utils';
import { Plus, Search, ArrowLeft, RefreshCw } from 'lucide-react';
import type { Organization } from '@/types';

const ORG_TYPE_VARIANTS: Record<string, 'blue' | 'purple' | 'green' | 'yellow'> = {
  government: 'blue',
  corporate: 'purple',
  cooperative: 'green',
  ngo: 'yellow',
};

const ORG_TYPE_OPTIONS = [
  { value: 'government', label: 'Government' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'ngo', label: 'NGO' },
];

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

export default function OrganizationsPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [orgType, setOrgType] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['organizations', { search, page, orgType, activeFilter }],
    queryFn: () => getOrganizations({
      search: search || undefined,
      page,
      limit: 25,
      org_type: orgType || undefined,
      is_active: activeFilter ? activeFilter === 'true' : undefined,
    }),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const columns: Column<Organization>[] = [
    {
      key: 'org_name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.org_name}</p>
          <p className="text-xs font-mono text-muted-foreground">{row.org_code}</p>
        </div>
      ),
    },
    {
      key: 'org_type',
      header: 'Type',
      render: (row) => (
        <Badge variant={ORG_TYPE_VARIANTS[row.org_type] || 'gray'}>
          {row.org_type.charAt(0).toUpperCase() + row.org_type.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'scoring_trust_level',
      header: 'Trust Level',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${row.scoring_trust_level}%` }}
            />
          </div>
          <span className="text-sm">{row.scoring_trust_level}</span>
        </div>
      ),
    },
    {
      key: 'total_members',
      header: 'Members',
      sortable: true,
      render: (row) => formatNumber(row.member_count ?? row.total_members),
    },
    {
      key: 'last_data_import_at',
      header: 'Last Import',
      render: (row) => row.last_data_import_at ? formatDate(row.last_data_import_at) : <span className="text-muted-foreground">Never</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'green' : 'gray'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/products')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Products
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
            <p className="text-sm text-muted-foreground">Manage partner organizations for digital loan verification.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => router.push('/products/organizations/new')}>
          <Plus className="mr-1 h-4 w-4" /> Add Organization
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form onSubmit={handleSearch} className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search organizations..."
            className="block w-full rounded-md border border-border py-2 pl-10 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </form>
        <Select
          options={ORG_TYPE_OPTIONS}
          placeholder="All Types"
          value={orgType}
          onChange={(e) => { setOrgType(e.target.value); setPage(1); }}
          className="w-40"
        />
        <Select
          options={STATUS_OPTIONS}
          placeholder="All Status"
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
          className="w-36"
        />
      </div>

      {isError ? (
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50 py-12 text-center dark:border-red-800 dark:bg-red-950">
          <p className="text-red-600 dark:text-red-400">Failed to load organizations.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Retry
          </Button>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data || []}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => router.push(`/products/organizations/${row.id}`)}
            loading={isLoading}
            emptyMessage="No organizations found"
          />

          {data && data.total_pages > 1 && (
            <Pagination
              page={data.page}
              totalPages={data.total_pages}
              total={data.total}
              limit={data.limit}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
