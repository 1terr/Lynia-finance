'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDistributors, getDistributorStats, createDistributor } from '@/lib/api/distributors';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { DistributorForm } from '@/components/distributors/distributor-form';
import { formatDate } from '@lynia/utils';
import { Plus, Search, Users, DollarSign, Smartphone, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Distributor, CreateDistributorInput } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_VARIANTS: Record<string, 'green' | 'gray' | 'red'> = {
  active: 'green',
  inactive: 'gray',
  suspended: 'red',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMoney(value: number | string | null | undefined): string {
  return `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
}

function StatCard({ label, value, icon, iconBg }: StatCardProps) {
  return (
    <div className="rounded-lg bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function DistributorsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // --- State ---
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  // --- Queries ---
  const { data, isLoading } = useQuery({
    queryKey: ['distributors', { search, status: statusFilter, page }],
    queryFn: () =>
      getDistributors({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 25,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ['distributor-stats'],
    queryFn: getDistributorStats,
  });

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: (input: CreateDistributorInput) => createDistributor(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributors'] });
      queryClient.invalidateQueries({ queryKey: ['distributor-stats'] });
      setFormOpen(false);
      toast({ title: 'Distributor created successfully', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create distributor',
        description: error.message,
        variant: 'error',
      });
    },
  });

  // --- Handlers ---
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setStatusFilter(e.target.value);
    setPage(1);
  }

  async function handleCreate(input: CreateDistributorInput) {
    await createMutation.mutateAsync(input);
  }

  // --- Columns ---
  // The API may return additional fields beyond the strict Distributor type
  // (e.g., contact_person, total_devices_sold, total_revenue_usd) depending
  // on the backend join/aggregation. We use a wider row type to handle this.
  type DistributorRow = Distributor & {
    contact_person?: string;
    total_devices_sold?: number;
    total_revenue_usd?: number;
  };

  const columns: Column<DistributorRow>[] = [
    {
      key: 'business_name',
      header: 'Business Name',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.business_name}</p>
          <p className="text-xs text-muted-foreground">{row.contact_person || row.name || '-'}</p>
        </div>
      ),
    },
    {
      key: 'phone_number',
      header: 'Phone',
      render: (row) => <span className="text-foreground">{row.phone_number}</span>,
    },
    {
      key: 'city',
      header: 'Location',
      render: (row) => {
        const parts = [row.city, row.province].filter(Boolean);
        return <span className="text-muted-foreground">{parts.length > 0 ? parts.join(', ') : '-'}</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] || 'gray'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'total_devices_sold',
      header: 'Devices Sold',
      sortable: true,
      render: (row) => (
        <span className="text-foreground">
          {row.total_devices_sold ?? row.total_devices_distributed ?? 0}
        </span>
      ),
    },
    {
      key: 'total_revenue_usd',
      header: 'Revenue',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-foreground">
          {formatMoney(row.total_revenue_usd ?? row.total_commissions_earned)}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (row) => <span className="text-muted-foreground">{formatDate(row.created_at)}</span>,
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Distributors</h1>
          <p className="text-sm text-muted-foreground">
            Manage distributor network, inventory assignments, and commissions.
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add Distributor
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Distributors"
          value={stats?.total ?? '-'}
          icon={<Users className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-100"
        />
        <StatCard
          label="Active"
          value={stats?.active ?? '-'}
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-100"
        />
        <StatCard
          label="Total Revenue"
          value={stats ? formatMoney(stats.total_revenue_usd) : '-'}
          icon={<DollarSign className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-100"
        />
        <StatCard
          label="Devices Distributed"
          value={stats?.total_devices_distributed ?? '-'}
          icon={<Smartphone className="h-5 w-5 text-purple-600" />}
          iconBg="bg-purple-100"
        />
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by business name, phone, or contact..."
            className="block w-full rounded-md border border-border py-2 pl-10 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </form>
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={handleStatusChange}
          className="w-full sm:w-40"
        />
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={(data?.data as DistributorRow[] | undefined) || []}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => router.push(`/distributors/${row.id}`)}
        loading={isLoading}
        emptyMessage="No distributors found"
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

      {/* Create Distributor Modal */}
      <DistributorForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
