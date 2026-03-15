'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@lynia/utils';
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
          <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
            {device.brand.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{device.brand} {device.model}</h2>
            <p className="text-sm text-muted-foreground">SKU: {device.sku}</p>
            {device.imei && <p className="text-sm text-muted-foreground">IMEI: {device.imei}</p>}
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
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Specifications</h3>
          <dl className="space-y-2 text-sm">
            {device.os && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Operating System</dt>
                <dd className="text-foreground">{device.os}</dd>
              </div>
            )}
            {device.processor && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Processor</dt>
                <dd className="text-foreground">{device.processor}</dd>
              </div>
            )}
            {device.ram_gb && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">RAM</dt>
                <dd className="text-foreground">{device.ram_gb} GB</dd>
              </div>
            )}
            {device.storage_gb && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Storage</dt>
                <dd className="text-foreground">{device.storage_gb} GB</dd>
              </div>
            )}
            {device.screen_size && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Screen Size</dt>
                <dd className="text-foreground">{device.screen_size}&quot;</dd>
              </div>
            )}
            {device.battery_mah && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Battery</dt>
                <dd className="text-foreground">{device.battery_mah} mAh</dd>
              </div>
            )}
            {device.camera_mp && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Camera</dt>
                <dd className="text-foreground">{device.camera_mp}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Pricing */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Pricing</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Cost Price</dt>
              <dd className="text-foreground">{formatCurrency(device.cost_price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Retail Price</dt>
              <dd className="text-foreground">{formatCurrency(device.retail_price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Financing Price</dt>
              <dd className="text-foreground font-semibold">{formatCurrency(device.financing_price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Deposit Amount</dt>
              <dd className="text-foreground">{formatCurrency(device.deposit_amount)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 mt-2">
              <dt className="text-muted-foreground">Margin</dt>
              <dd className="text-green-700 font-medium">
                {formatCurrency(device.retail_price - device.cost_price)} ({((device.retail_price - device.cost_price) / device.cost_price * 100).toFixed(0)}%)
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Location & Lock Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Location</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Distributor</dt>
              <dd className="text-foreground">{device.distributors?.business_name || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Contact</dt>
              <dd className="text-foreground">{device.distributors?.contact_person || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Warehouse</dt>
              <dd className="text-foreground">{device.warehouse_location || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Region</dt>
              <dd className="text-foreground">
                {device.distributors ? `${device.distributors.city}, ${device.distributors.province}` : '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Lock Information</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Lock Enabled</dt>
              <dd>
                {device.lock_enabled ? (
                  <span className="text-green-700 font-medium">Yes</span>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Lock Provider</dt>
              <dd className="text-foreground">{device.lock_provider || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Provider ID</dt>
              <dd className="text-foreground">{device.lock_provider_id || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="text-foreground">{formatDate(device.created_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
