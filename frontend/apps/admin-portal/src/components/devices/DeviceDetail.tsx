'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { DeviceWithRelations } from '@/types/database';

interface DeviceDetailProps {
  device: DeviceWithRelations;
}

const statusConfig: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' }> = {
  available: { label: 'Available', variant: 'green' },
  reserved: { label: 'Reserved', variant: 'yellow' },
  assigned: { label: 'Assigned', variant: 'blue' },
  sold: { label: 'Sold', variant: 'purple' },
  damaged: { label: 'Damaged', variant: 'red' },
  returned: { label: 'Returned', variant: 'gray' },
};

export function DeviceDetail({ device }: DeviceDetailProps) {
  const statusInfo = statusConfig[device.status] || { label: device.status, variant: 'gray' as const };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600">
            {device.brand.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{device.brand} {device.model}</h2>
            <p className="text-sm text-gray-500">SKU: {device.sku}</p>
            {device.imei && <p className="text-sm text-gray-500">IMEI: {device.imei}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          {device.featured && <Badge variant="gold">Featured</Badge>}
        </div>
      </div>

      {/* Specs & Pricing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Specifications */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Specifications</h3>
          <dl className="space-y-2 text-sm">
            {device.os && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Operating System</dt>
                <dd className="text-gray-900">{device.os}</dd>
              </div>
            )}
            {device.processor && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Processor</dt>
                <dd className="text-gray-900">{device.processor}</dd>
              </div>
            )}
            {device.ram_gb && (
              <div className="flex justify-between">
                <dt className="text-gray-500">RAM</dt>
                <dd className="text-gray-900">{device.ram_gb} GB</dd>
              </div>
            )}
            {device.storage_gb && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Storage</dt>
                <dd className="text-gray-900">{device.storage_gb} GB</dd>
              </div>
            )}
            {device.screen_size && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Screen Size</dt>
                <dd className="text-gray-900">{device.screen_size}&quot;</dd>
              </div>
            )}
            {device.battery_mah && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Battery</dt>
                <dd className="text-gray-900">{device.battery_mah} mAh</dd>
              </div>
            )}
            {device.camera_mp && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Camera</dt>
                <dd className="text-gray-900">{device.camera_mp}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Pricing</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Cost Price</dt>
              <dd className="text-gray-900">{formatCurrency(device.cost_price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Retail Price</dt>
              <dd className="text-gray-900">{formatCurrency(device.retail_price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Financing Price</dt>
              <dd className="text-gray-900 font-semibold">{formatCurrency(device.financing_price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Deposit Amount</dt>
              <dd className="text-gray-900">{formatCurrency(device.deposit_amount)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
              <dt className="text-gray-500">Margin</dt>
              <dd className="text-green-700 font-medium">
                {formatCurrency(device.retail_price - device.cost_price)} ({((device.retail_price - device.cost_price) / device.cost_price * 100).toFixed(0)}%)
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Location & Lock Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Location</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Distributor</dt>
              <dd className="text-gray-900">{device.distributors?.business_name || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Contact</dt>
              <dd className="text-gray-900">{device.distributors?.contact_person || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Warehouse</dt>
              <dd className="text-gray-900">{device.warehouse_location || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Region</dt>
              <dd className="text-gray-900">
                {device.distributors ? `${device.distributors.city}, ${device.distributors.province}` : '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Lock Information</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Lock Enabled</dt>
              <dd>
                {device.lock_enabled ? (
                  <span className="text-green-700 font-medium">Yes</span>
                ) : (
                  <span className="text-gray-500">No</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Lock Provider</dt>
              <dd className="text-gray-900">{device.lock_provider || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Provider ID</dt>
              <dd className="text-gray-900">{device.lock_provider_id || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-gray-900">{formatDate(device.created_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
