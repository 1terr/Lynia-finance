'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { SearchBar } from '@/components/shared/SearchBar';
import { DeviceTable } from '@/components/devices/DeviceTable';
import { DeviceFilters } from '@/components/devices/DeviceFilters';
import { DeviceSummaryCards } from '@/components/devices/DeviceSummaryCards';
import { BulkOperations } from '@/components/devices/BulkOperations';
import {
  fetchDevices,
  fetchDeviceInventorySummary,
  fetchDistributors,
  bulkUpdateDeviceStatus,
  bulkAssignDistributor,
  exportDevicesToCSV,
} from '@/lib/api/devices';
import type { Device } from '@/types/database';

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [brand, setBrand] = useState('');
  const [lockEnabled, setLockEnabled] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['devices', search, status, brand, lockEnabled, page],
    queryFn: () =>
      fetchDevices({
        search: search || undefined,
        status: status ? (status as Device['status']) : undefined,
        brand: brand || undefined,
        lock_enabled: lockEnabled ? lockEnabled === 'true' : undefined,
        page,
        limit,
      }),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['device-summary'],
    queryFn: fetchDeviceInventorySummary,
  });

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: fetchDistributors,
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: Device['status'] }) =>
      bulkUpdateDeviceStatus(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-summary'] });
      setSelectedDevices([]);
    },
  });

  const bulkDistributorMutation = useMutation({
    mutationFn: ({ ids, distributorId }: { ids: string[]; distributorId: string }) =>
      bulkAssignDistributor(ids, distributorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setSelectedDevices([]);
    },
  });

  const handleSelectDevice = useCallback((deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!data?.devices) return;
    const allIds = data.devices.map((d) => d.id);
    const allSelected = allIds.every((id) => selectedDevices.includes(id));
    setSelectedDevices(allSelected ? [] : allIds);
  }, [data?.devices, selectedDevices]);

  const handleExport = () => {
    if (!data?.devices) return;
    const csv = exportDevicesToCSV(data.devices);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devices-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Device Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage device inventory, assignments, and lock controls</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/devices/handovers"
            className="px-4 py-2 bg-white text-gray-700 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Handovers
          </Link>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-white text-gray-700 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <DeviceSummaryCards summary={summary || null} loading={summaryLoading} />

      {/* Bulk Operations */}
      <BulkOperations
        selectedCount={selectedDevices.length}
        onBulkStatusChange={(newStatus) =>
          bulkStatusMutation.mutate({ ids: selectedDevices, status: newStatus })
        }
        onBulkAssignDistributor={(distributorId) =>
          bulkDistributorMutation.mutate({ ids: selectedDevices, distributorId })
        }
        onClearSelection={() => setSelectedDevices([])}
        distributors={distributors}
        isLoading={bulkStatusMutation.isPending || bulkDistributorMutation.isPending}
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={(val) => { setSearch(val); setPage(1); }}
            placeholder="Search by brand, model, SKU, or IMEI..."
          />
        </div>
        <DeviceFilters
          status={status}
          brand={brand}
          lockEnabled={lockEnabled}
          onStatusChange={(val) => { setStatus(val); setPage(1); }}
          onBrandChange={(val) => { setBrand(val); setPage(1); }}
          onLockEnabledChange={(val) => { setLockEnabled(val); setPage(1); }}
        />
      </div>

      {/* Device Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading devices...</div>
        ) : (
          <DeviceTable
            devices={data?.devices || []}
            total={data?.total || 0}
            page={page}
            limit={limit}
            onPageChange={setPage}
            selectedDevices={selectedDevices}
            onSelectDevice={handleSelectDevice}
            onSelectAll={handleSelectAll}
          />
        )}
      </div>
    </div>
  );
}
