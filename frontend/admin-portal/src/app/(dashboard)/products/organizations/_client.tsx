'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrganizations, createOrganization } from '@/lib/api/products';
import { OrganizationForm } from '@/components/products/organization-form';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate, formatNumber } from '@/lib/utils';
import { Plus, Search, ArrowLeft } from 'lucide-react';
import type { Organization, CreateOrganizationInput } from '@/types';

const ORG_TYPE_VARIANTS: Record<string, 'blue' | 'purple' | 'green' | 'yellow'> = {
  government: 'blue',
  corporate: 'purple',
  cooperative: 'green',
  ngo: 'yellow',
};

export default function OrganizationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['organizations', { search, page }],
    queryFn: () => getOrganizations({ search: search || undefined, page, limit: 25 }),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateOrganizationInput) => createOrganization(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setFormOpen(false);
    },
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
          <p className="font-medium text-gray-900">{row.org_name}</p>
          <p className="text-xs font-mono text-gray-500">{row.org_code}</p>
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
          <div className="h-2 w-16 rounded-full bg-gray-200">
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
      render: (row) => row.last_data_import_at ? formatDate(row.last_data_import_at) : <span className="text-gray-400">Never</span>,
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
            <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
            <p className="text-sm text-gray-500">Manage partner organizations for digital loan verification.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add Organization
        </Button>
      </div>

      <form onSubmit={handleSearch} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search organizations..."
          className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </form>

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

      <OrganizationForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (d) => { await createMutation.mutateAsync(d); }}
      />
    </div>
  );
}
