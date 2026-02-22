'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  getInventoryReport,
  getMovementsReport,
  getLowStockReport,
  type InventoryReportModelRow,
  type LowStockModel,
} from '@/lib/api/devices';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Clock,
  XCircle,
} from 'lucide-react';

type Tab = 'overview' | 'movements' | 'low-stock';

export default function InventoryReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [movementDays, setMovementDays] = useState(30);

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['inventory-report'],
    queryFn: getInventoryReport,
  });

  const { data: movements, isLoading: movementsLoading } = useQuery({
    queryKey: ['movements-report', movementDays],
    queryFn: () => getMovementsReport(movementDays),
    enabled: activeTab === 'movements',
  });

  const { data: lowStock, isLoading: lowStockLoading } = useQuery({
    queryKey: ['low-stock-report'],
    queryFn: getLowStockReport,
    enabled: activeTab === 'low-stock',
  });

  const modelColumns: Column<InventoryReportModelRow>[] = [
    {
      key: 'manufacturer',
      header: 'Model',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.manufacturer} {row.model_name}</p>
          <p className="text-xs text-gray-500">{row.total_units} total units</p>
        </div>
      ),
    },
    {
      key: 'in_stock',
      header: 'In Stock',
      render: (row) => (
        <span className={`text-sm font-medium ${row.in_stock <= (row.reorder_level || 0) ? 'text-red-600' : 'text-green-600'}`}>
          {row.in_stock}
        </span>
      ),
    },
    {
      key: 'assigned',
      header: 'Assigned',
      render: (row) => <span className="text-sm">{row.assigned}</span>,
    },
    {
      key: 'sold',
      header: 'Sold',
      render: (row) => <span className="text-sm">{row.sold}</span>,
    },
    {
      key: 'damaged',
      header: 'Damaged',
      render: (row) => (
        <span className={`text-sm ${row.damaged > 0 ? 'text-orange-600 font-medium' : ''}`}>
          {row.damaged}
        </span>
      ),
    },
    {
      key: 'in_stock_value',
      header: 'Stock Value',
      render: (row) => <span className="text-sm">{formatCurrency(row.in_stock_value)}</span>,
    },
    {
      key: 'reorder_level',
      header: 'Reorder Lvl',
      render: (row) => (
        <div className="flex items-center gap-1">
          <span className="text-sm">{row.reorder_level || '-'}</span>
          {row.reorder_level > 0 && row.in_stock <= row.reorder_level && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          )}
        </div>
      ),
    },
  ];

  const lowStockColumns: Column<LowStockModel>[] = [
    {
      key: 'manufacturer',
      header: 'Model',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.manufacturer} {row.model_name}</p>
          <p className="text-xs text-gray-500">{formatCurrency(row.retail_price_usd)} retail</p>
        </div>
      ),
    },
    {
      key: 'available_stock',
      header: 'Available',
      render: (row) => (
        <span className={`text-sm font-semibold ${row.available_stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
          {row.available_stock}
        </span>
      ),
    },
    {
      key: 'reorder_level',
      header: 'Reorder Level',
      render: (row) => <span className="text-sm">{row.reorder_level}</span>,
    },
    {
      key: 'deficit',
      header: 'Deficit',
      render: (row) => (
        <Badge variant="status" status="failed">
          -{row.deficit}
        </Badge>
      ),
    },
    {
      key: 'lead_time_days',
      header: 'Lead Time',
      render: (row) => (
        <span className="text-sm text-gray-600">
          {row.lead_time_days ? `${row.lead_time_days} days` : '-'}
        </span>
      ),
    },
    {
      key: 'actual_in_stock',
      header: 'Actual In Stock',
      render: (row) => <span className="text-sm">{row.actual_in_stock}</span>,
    },
    {
      key: 'reserved',
      header: 'Reserved',
      render: (row) => <span className="text-sm">{row.reserved}</span>,
    },
  ];

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Stock Overview', icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'movements', label: 'Movements', icon: <TrendingUp className="h-4 w-4" /> },
    { key: 'low-stock', label: 'Low Stock Alerts', icon: <AlertTriangle className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/devices" className="rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Reports</h1>
          <p className="text-sm text-gray-500">Stock levels, movements, and low-stock alerts</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {report?.totals && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Devices</p>
                    <p className="text-lg font-semibold">{report.totals.total_devices}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">In Stock</p>
                    <p className="text-lg font-semibold">{report.totals.total_in_stock}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-50 p-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Available Value</p>
                    <p className="text-lg font-semibold">{formatCurrency(report.totals.available_inventory_value)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-orange-50 p-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Damaged/Lost</p>
                    <p className="text-lg font-semibold text-orange-600">
                      {(report.totals.total_damaged || 0) + (report.totals.total_lost || 0)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Stock Aging */}
          {report?.aging && report.aging.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  Stock Aging (In Stock Only)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-4">
                  {report.aging.map((bucket) => (
                    <div key={bucket.age_bracket} className="rounded-lg border p-3">
                      <p className="text-sm font-medium text-gray-700">{bucket.age_bracket}</p>
                      <p className="text-lg font-semibold">{bucket.count} units</p>
                      <p className="text-xs text-gray-500">{formatCurrency(bucket.value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stock by Model */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock by Device Model</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={modelColumns}
                data={report?.by_model || []}
                keyExtractor={(row) => row.device_model_id}
                loading={reportLoading}
                emptyMessage="No device models found"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Movements Tab */}
      {activeTab === 'movements' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Period:</span>
            {[7, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setMovementDays(d)}
                className={`rounded-md px-3 py-1 text-sm ${
                  movementDays === d
                    ? 'bg-brand-100 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {d} days
              </button>
            ))}
          </div>

          {/* Movement Type Summary */}
          {movements?.by_type && (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {movements.by_type.map((entry) => (
                <Card key={entry.movement_type} className="p-4">
                  <p className="text-sm capitalize text-gray-600">
                    {entry.movement_type.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{entry.count}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Recent Movements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Movements</CardTitle>
            </CardHeader>
            <CardContent>
              {movementsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-200" />
                  ))}
                </div>
              ) : movements?.recent && movements.recent.length > 0 ? (
                <div className="divide-y">
                  {movements.recent.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="status" status={m.movement_type === 'received' ? 'active' : m.movement_type === 'handover' ? 'completed' : 'pending'}>
                          {m.movement_type.replace(/_/g, ' ')}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{m.manufacturer} {m.device_model}</p>
                          <p className="font-mono text-xs text-gray-500">{m.device_imei}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {m.from_status && m.to_status
                            ? `${m.from_status} → ${m.to_status}`
                            : m.to_status || '-'}
                        </p>
                        <p className="text-xs text-gray-400">{formatDateTime(m.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-gray-500">No movements in this period</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Low Stock Tab */}
      {activeTab === 'low-stock' && (
        <div className="space-y-6">
          {/* Alert Summary */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Low Stock Models</p>
                  <p className="text-2xl font-bold text-amber-900">{lowStock?.total_low_stock ?? 0}</p>
                </div>
              </div>
            </Card>
            <Card className="border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-900">{lowStock?.total_out_of_stock ?? 0}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Low Stock Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Models Below Reorder Level</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={lowStockColumns}
                data={lowStock?.low_stock_models || []}
                keyExtractor={(row) => row.id}
                loading={lowStockLoading}
                emptyMessage="All models are above reorder level"
              />
            </CardContent>
          </Card>

          {/* Out of Stock */}
          {lowStock?.out_of_stock_models && lowStock.out_of_stock_models.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-red-700">
                  <XCircle className="h-4 w-4" />
                  Out of Stock Models
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {lowStock.out_of_stock_models.map((model) => (
                    <div key={model.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium">{model.manufacturer} {model.model_name}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(model.retail_price_usd)} retail</p>
                      </div>
                      <Badge variant="status" status="failed">Out of Stock</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
