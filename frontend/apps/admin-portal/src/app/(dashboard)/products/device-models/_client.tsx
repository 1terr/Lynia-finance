'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeviceModels, createDeviceModel, updateDeviceModel, deleteDeviceModel } from '@/lib/api/products';
import { DeviceModelForm } from '@/components/products/device-model-form';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@lynia/utils';
import { Plus, Search, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { DeviceModel, CreateDeviceModelInput } from '@/types';

const BRAND_OPTIONS = [
  { value: '', label: 'All Brands' },
  { value: 'Samsung', label: 'Samsung' },
  { value: 'Tecno', label: 'Tecno' },
  { value: 'Itel', label: 'Itel' },
  { value: 'Nokia', label: 'Nokia' },
  { value: 'Xiaomi', label: 'Xiaomi' },
  { value: 'Huawei', label: 'Huawei' },
];

export default function DeviceModelsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<DeviceModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceModel | null>(null);
  const [brand, setBrand] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['device-models', { brand, search, page }],
    queryFn: () => getDeviceModels({ brand: brand || undefined, search: search || undefined, page, limit: 25 }),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateDeviceModelInput) => createDeviceModel(d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['device-models'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<DeviceModel> }) => updateDeviceModel(id, d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['device-models'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDeviceModel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-models'] });
      setDeleteTarget(null);
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  async function handleFormSubmit(formData: CreateDeviceModelInput) {
    if (editingModel) {
      await updateMutation.mutateAsync({ id: editingModel.id, d: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
  }

  const columns: Column<DeviceModel>[] = [
    {
      key: 'brand',
      header: 'Brand',
      sortable: true,
      render: (row) => <span className="font-medium">{row.brand}</span>,
    },
    {
      key: 'model_name',
      header: 'Model',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.model_name}</p>
          <p className="text-xs font-mono text-gray-500">{row.model_code}</p>
        </div>
      ),
    },
    {
      key: 'storage_gb',
      header: 'Storage',
      render: (row) => row.storage_gb ? `${row.storage_gb} GB` : '-',
    },
    {
      key: 'retail_price_usd',
      header: 'Retail Price',
      sortable: true,
      render: (row) => formatCurrency(row.retail_price_usd),
    },
    {
      key: 'wholesale_price_usd',
      header: 'Wholesale Price',
      sortable: true,
      render: (row) => formatCurrency(row.wholesale_price_usd),
    },
    {
      key: 'available_stock',
      header: 'Stock',
      sortable: true,
      render: (row) => (
        <span className={row.available_stock === 0 ? 'text-red-600 font-medium' : ''}>
          {row.available_stock}
        </span>
      ),
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
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingModel(row); setFormOpen(true); }}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}>
            Delete
          </Button>
        </div>
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
            <h1 className="text-2xl font-bold text-gray-900">Device Models</h1>
            <p className="text-sm text-gray-500">Manage the device catalog for smartphone financing.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setEditingModel(null); setFormOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Add Device Model
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by brand or model name..."
            className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </form>
        <Select
          options={BRAND_OPTIONS}
          value={brand}
          onChange={(e) => { setBrand(e.target.value); setPage(1); }}
          className="w-full sm:w-40"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyMessage="No device models found"
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

      <DeviceModelForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        deviceModel={editingModel}
      />

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Device Model" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-medium">{deleteTarget?.brand} {deleteTarget?.model_name}</span>?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" isLoading={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
