'use client';

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/shared/Pagination';
import { formatCurrency, truncateId } from '@lynia/utils';
import type { DeviceWithRelations } from '@/types/database';

interface DeviceTableProps {
  devices: DeviceWithRelations[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  selectedDevices?: string[];
  onSelectDevice?: (deviceId: string) => void;
  onSelectAll?: () => void;
}

const statusConfig: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' }> = {
  available: { label: 'Available', variant: 'green' },
  reserved: { label: 'Reserved', variant: 'yellow' },
  assigned: { label: 'Assigned', variant: 'blue' },
  sold: { label: 'Sold', variant: 'purple' },
  damaged: { label: 'Damaged', variant: 'red' },
  returned: { label: 'Returned', variant: 'gray' },
};

export function DeviceTable({
  devices,
  total,
  page,
  limit,
  onPageChange,
  selectedDevices = [],
  onSelectDevice,
  onSelectAll,
}: DeviceTableProps) {
  const allSelected = devices.length > 0 && devices.every((d) => selectedDevices.includes(d.id));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {onSelectDevice && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    className="rounded border-gray-300"
                    aria-label="Select all devices"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU / IMEI</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lock</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distributor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {devices.map((device) => {
              const statusInfo = statusConfig[device.status] || { label: device.status, variant: 'gray' as const };
              return (
                <tr key={device.id} className="hover:bg-gray-50">
                  {onSelectDevice && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedDevices.includes(device.id)}
                        onChange={() => onSelectDevice(device.id)}
                        className="rounded border-gray-300"
                        aria-label={`Select ${device.brand} ${device.model}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                        {device.brand.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{device.brand} {device.model}</p>
                        <p className="text-xs text-gray-500">
                          {device.storage_gb ? `${device.storage_gb}GB` : ''}{device.ram_gb ? ` / ${device.ram_gb}GB RAM` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900">{device.sku}</p>
                    <p className="text-xs text-gray-500">{device.imei || 'No IMEI'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(device.financing_price)}</p>
                    <p className="text-xs text-gray-500">Retail: {formatCurrency(device.retail_price)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {device.lock_enabled ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-gray-300" />
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900">{device.distributors?.business_name || '—'}</p>
                    <p className="text-xs text-gray-500">{device.warehouse_location || ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/devices/${device.id}`}
                      className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {devices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No devices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {total > limit && (
        <div className="mt-4">
          <Pagination
            page={page}
            limit={limit}
            total={total}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
