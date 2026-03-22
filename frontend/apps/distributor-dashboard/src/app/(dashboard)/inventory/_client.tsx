'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import type { InventoryDevice } from '@/types/distributor';
import { fetchInventory } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@lynia/utils';
import { InventorySkeleton } from '@/components/ui/skeleton';
import {
  Smartphone,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  ArrowUpDown,
  ChevronDown,
  DollarSign,
  Package,
  Download,
} from 'lucide-react';

type StatusFilter = 'all' | InventoryDevice['status'];
type SortOption = 'recent' | 'price_high' | 'price_low' | 'brand';

const STATUS_CONFIG: Record<InventoryDevice['status'], {
  label: string;
  variant: 'success' | 'warning' | 'info' | 'destructive' | 'default';
  icon: typeof CheckCircle;
}> = {
  available: { label: 'Available', variant: 'success', icon: CheckCircle },
  reserved: { label: 'Reserved', variant: 'warning', icon: Clock },
  damaged: { label: 'Damaged', variant: 'destructive', icon: AlertTriangle },
};

const CONDITION_LABELS: Record<InventoryDevice['condition'], string> = {
  new: 'New',
  grade_a: 'Grade A',
  grade_b: 'Grade B',
  grade_c: 'Grade C',
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recently Received' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'brand', label: 'Brand A-Z' },
];

function exportInventoryCSV(devices: InventoryDevice[]) {
  const header = 'IMEI,Brand,Model,Status,Condition,Price,Received Date\n';
  const rows = devices
    .map(
      (d) =>
        `${d.imei},${d.brand},${d.model},${d.status},${CONDITION_LABELS[d.condition]},$${d.retail_price.toFixed(2)},${new Date(d.received_at).toLocaleDateString('en-ZW')}`,
    )
    .join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function sortDevices(devices: InventoryDevice[], sort: SortOption): InventoryDevice[] {
  const sorted = [...devices];
  switch (sort) {
    case 'recent':
      return sorted.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    case 'price_high':
      return sorted.sort((a, b) => b.retail_price - a.retail_price);
    case 'price_low':
      return sorted.sort((a, b) => a.retail_price - b.retail_price);
    case 'brand':
      return sorted.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
  }
}

export default function InventoryPage() {
  const { data: devices = [], isLoading: loading } = useQuery({
    queryKey: ['distributor', 'inventory'],
    queryFn: fetchInventory,
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const filteredDevices = useMemo(() => {
    const filtered = devices.filter((device) => {
      const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
      const query = debouncedSearch.toLowerCase();
      const matchesSearch =
        !query ||
        device.model.toLowerCase().includes(query) ||
        device.brand.toLowerCase().includes(query) ||
        device.imei.includes(query);
      return matchesStatus && matchesSearch;
    });
    return sortDevices(filtered, sortBy);
  }, [devices, statusFilter, debouncedSearch, sortBy]);

  const statusCounts = devices.reduce<Record<string, number>>(
    (acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    },
    {},
  );

  const availableCount = statusCounts['available'] || 0;
  const totalValue = devices
    .filter((d) => d.status === 'available')
    .reduce((sum, d) => sum + d.retail_price, 0);

  if (loading) {
    return <InventorySkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Device Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {devices.length} devices assigned to you
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportInventoryCSV(filteredDevices)}
          className="hidden sm:inline-flex"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Low stock alert */}
      {availableCount < 3 && availableCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 p-3">
          <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            Low stock: Only <strong>{availableCount}</strong> device{availableCount !== 1 ? 's' : ''} available. Request more inventory from Lynia.
          </p>
        </div>
      )}
      {availableCount === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            No available devices. Contact Lynia to restock your inventory.
          </p>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['available', 'reserved', 'damaged'] as const).map((status) => {
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          return (
            <button
              key={status}
              onClick={() =>
                setStatusFilter(statusFilter === status ? 'all' : status)
              }
              aria-pressed={statusFilter === status}
              className={cn(
                'rounded-xl border bg-card p-4 shadow-sm text-left transition-colors',
                statusFilter === status && 'ring-2 ring-primary',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground capitalize">
                  {config.label}
                </span>
              </div>
              <p className="text-xl font-bold">{statusCounts[status] || 0}</p>
            </button>
          );
        })}

        {/* Total inventory value */}
        <div className="rounded-xl border bg-card p-4 shadow-sm text-left">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Total Value
            </span>
          </div>
          <p className="text-xl font-bold">${totalValue.toFixed(0)}</p>
        </div>
      </div>

      {/* Search, sort, and filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by model, brand, or IMEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search devices"
            className="w-full rounded-lg border bg-background pl-9 pr-4 py-2.5 text-base h-11 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort devices"
              className="appearance-none rounded-lg border bg-background pl-8 pr-8 py-2.5 text-sm font-medium h-11 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"
            >
              <Filter className="h-3 w-3" />
              Clear: {STATUS_CONFIG[statusFilter].label}
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportInventoryCSV(filteredDevices)}
            className="sm:hidden"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Device list */}
      {filteredDevices.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 shadow-sm text-center">
          <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
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
            const isExpanded = expandedId === device.id;
            return (
              <div
                key={device.id}
                className="rounded-xl border bg-card shadow-sm overflow-hidden"
              >
                <button
                  className="w-full p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : device.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Smartphone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{device.brand} {device.model}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          IMEI: {device.imei}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={config.variant} className="text-xs">
                        {config.label}
                      </Badge>
                      <ChevronDown className={cn(
                        'h-3.5 w-3.5 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-180',
                      )} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">
                        ${device.retail_price.toFixed(2)}
                      </span>
                      <span>{CONDITION_LABELS[device.condition]}</span>
                    </div>
                    <span>
                      Received{' '}
                      {new Date(device.received_at).toLocaleDateString('en-ZW', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t">
                    <div className="grid grid-cols-2 gap-3 text-sm pt-3">
                      <div>
                        <p className="text-muted-foreground">Brand</p>
                        <p className="font-medium">{device.brand}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Model</p>
                        <p className="font-medium">{device.model}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Condition</p>
                        <p className="font-medium">{CONDITION_LABELS[device.condition]}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Price</p>
                        <p className="font-medium">${device.retail_price.toFixed(2)}</p>
                      </div>
                      {device.storage_gb && (
                        <div>
                          <p className="text-muted-foreground">Storage</p>
                          <p className="font-medium">{device.storage_gb} GB</p>
                        </div>
                      )}
                      {device.color && (
                        <div>
                          <p className="text-muted-foreground">Color</p>
                          <p className="font-medium capitalize">{device.color}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-muted-foreground">IMEI</p>
                        <p className="font-medium font-mono">{device.imei}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Received</p>
                        <p className="font-medium">
                          {new Date(device.received_at).toLocaleDateString('en-ZW', {
                            weekday: 'short',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
