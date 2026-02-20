'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getDevices, getDeviceStats, type DeviceFilters, type DeviceWithCustomer } from '@/lib/api/devices';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Device, DeviceStatus, LockStatus } from '@/types';
import { Search, Smartphone, Lock, Unlock, Package } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'sold', label: 'Sold' },
  { value: 'returned', label: 'Returned' },
  { value: 'repossessed', label: 'Repossessed' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost' },
  { value: 'written_off', label: 'Written Off' },
];

const LOCK_STATUS_OPTIONS = [
  { value: '', label: 'All Lock Status' },
  { value: 'unlocked', label: 'Unlocked' },
  { value: 'locked', label: 'Locked' },
  { value: 'pending', label: 'Pending' },
];

export default function DevicesPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<DeviceFilters>({ page: 1, limit: 25 });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['devices', filters],
    queryFn: () => getDevices(filters),
  });

  const { data: stats } = useQuery({
    queryKey: ['device-stats'],
    queryFn: () => getDeviceStats(),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput || undefined, page: 1 }));
  }

  const columns: Column<DeviceWithCustomer>[] = [
    {
      key: 'manufacturer',
      header: 'Device',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">
            {row.manufacturer} {row.model}
          </p>
          <p className="font-mono text-xs text-gray-500">{row.imei}</p>
        </div>
      ),
    },
    {
      key: 'condition',
      header: 'Condition',
      render: (row) => (
        <span className="capitalize">{row.condition.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'retail_price_usd',
      header: 'Value',
      sortable: true,
      render: (row) => formatCurrency(row.retail_price_usd),
    },
    {
      key: 'lock_status',
      header: 'Lock Status',
      render: (row) => (
        <Badge variant="status" status={row.lock_status}>
          {row.lock_status}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant="status" status={row.status}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) =>
        row.customer ? (
          <span className="text-sm">{row.customer.full_name}</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'created_at',
      header: 'Added',
      sortable: true,
      render: (row) => <span className="text-gray-500">{formatDate(row.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
          <p className="text-sm text-gray-500">
            Manage device inventory, lock status, and assignments.
          </p>
        </div>
        {data && (
          <p className="text-sm text-gray-500">{data.total} total devices</p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In Stock</p>
              <p className="text-lg font-semibold">{stats?.in_stock ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <Smartphone className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Sold/Active</p>
              <p className="text-lg font-semibold">{stats?.sold ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2">
              <Lock className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Locked</p>
              <p className="text-lg font-semibold">{stats?.locked ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-50 p-2">
              <Package className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Returned</p>
              <p className="text-lg font-semibold">{stats?.returned ?? 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by IMEI, brand, or model..."
            className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </form>
        <Select
          options={STATUS_OPTIONS}
          value={filters.status || ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              status: (e.target.value || undefined) as DeviceStatus | undefined,
              page: 1,
            }))
          }
          className="w-full sm:w-40"
        />
        <Select
          options={LOCK_STATUS_OPTIONS}
          value={filters.lock_status || ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              lock_status: (e.target.value || undefined) as LockStatus | undefined,
              page: 1,
            }))
          }
          className="w-full sm:w-40"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => router.push(`/devices/${row.id}`)}
        loading={isLoading}
        emptyMessage="No devices found"
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
