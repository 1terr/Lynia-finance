'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { InventoryDevice } from '@/types/distributor';
import { fetchInventory } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { cn } from '@lynia/utils';
import {
  Smartphone,
  Search,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShoppingCart,
  Filter,
} from 'lucide-react';

type StatusFilter = 'all' | InventoryDevice['status'];

const STATUS_CONFIG: Record<InventoryDevice['status'], {
  label: string;
  variant: 'success' | 'warning' | 'info' | 'destructive' | 'default';
  icon: typeof CheckCircle;
}> = {
  available: { label: 'Available', variant: 'success', icon: CheckCircle },
  reserved: { label: 'Reserved', variant: 'warning', icon: Clock },
  assigned: { label: 'Assigned', variant: 'info', icon: ShoppingCart },
  sold: { label: 'Sold', variant: 'default', icon: Package },
  damaged: { label: 'Damaged', variant: 'destructive', icon: AlertTriangle },
};

const CONDITION_LABELS: Record<InventoryDevice['condition'], string> = {
  new: 'New',
  refurbished: 'Refurbished',
  used: 'Used',
};

export default function InventoryPage() {
  const { data: devices = [], isLoading: loading } = useQuery({
    queryKey: ['distributor', 'inventory'],
    queryFn: fetchInventory,
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDevices = devices.filter((device) => {
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      device.model.toLowerCase().includes(query) ||
      device.brand.toLowerCase().includes(query) ||
      device.imei.includes(query);
    return matchesStatus && matchesSearch;
  });

  const statusCounts = devices.reduce<Record<string, number>>(
    (acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    },
    {}
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold md:text-2xl">Device Inventory</h1>
        <p className="text-sm text-muted-foreground">
          {devices.length} devices assigned to you
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(['available', 'reserved', 'assigned', 'sold', 'damaged'] as const).map(
          (status) => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            return (
              <button
                key={status}
                onClick={() =>
                  setStatusFilter(statusFilter === status ? 'all' : status)
                }
                className={cn(
                  'rounded-xl border bg-card p-3 shadow-sm text-left transition-colors',
                  statusFilter === status && 'ring-2 ring-primary'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground capitalize">
                    {config.label}
                  </span>
                </div>
                <p className="text-xl font-bold">{statusCounts[status] || 0}</p>
              </button>
            );
          }
        )}
      </div>

      {/* Search and filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by model, brand, or IMEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {statusFilter !== 'all' && (
          <button
            onClick={() => setStatusFilter('all')}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"
          >
            <Filter className="h-3 w-3" />
            Clear filter: {STATUS_CONFIG[statusFilter].label}
          </button>
        )}
      </div>

      {/* Device list */}
      {filteredDevices.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 shadow-sm text-center">
          <Smartphone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchQuery || statusFilter !== 'all'
              ? 'No devices match your search criteria'
              : 'No devices in your inventory'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDevices.map((device) => {
            const config = STATUS_CONFIG[device.status];
            return (
              <div
                key={device.id}
                className="rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{device.brand} {device.model}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        IMEI: {device.imei}
                      </p>
                    </div>
                  </div>
                  <Badge variant={config.variant} className="text-[10px]">
                    {config.label}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                  <div className="flex items-center gap-3">
                    <span>
                      <span className="font-medium text-foreground">
                        ${device.retail_price.toFixed(2)}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {CONDITION_LABELS[device.condition]}
                    </span>
                  </div>
                  <span>
                    Received{' '}
                    {new Date(device.received_at).toLocaleDateString('en-ZW', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
