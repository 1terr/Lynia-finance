'use client';

import React from 'react';

interface DeviceFiltersProps {
  status: string;
  brand: string;
  lockEnabled: string;
  onStatusChange: (status: string) => void;
  onBrandChange: (brand: string) => void;
  onLockEnabledChange: (lockEnabled: string) => void;
}

const BRANDS = ['Samsung', 'Tecno', 'Infinix', 'Itel', 'Nokia'];

export function DeviceFilters({
  status,
  brand,
  lockEnabled,
  onStatusChange,
  onBrandChange,
  onLockEnabledChange,
}: DeviceFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        aria-label="Filter by status"
      >
        <option value="">All Statuses</option>
        <option value="available">Available</option>
        <option value="reserved">Reserved</option>
        <option value="assigned">Assigned</option>
        <option value="sold">Sold</option>
        <option value="damaged">Damaged</option>
        <option value="returned">Returned</option>
      </select>

      <select
        value={brand}
        onChange={(e) => onBrandChange(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        aria-label="Filter by brand"
      >
        <option value="">All Brands</option>
        {BRANDS.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>

      <select
        value={lockEnabled}
        onChange={(e) => onLockEnabledChange(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        aria-label="Filter by lock status"
      >
        <option value="">All Lock States</option>
        <option value="true">Lock Enabled</option>
        <option value="false">Lock Disabled</option>
      </select>
    </div>
  );
}
