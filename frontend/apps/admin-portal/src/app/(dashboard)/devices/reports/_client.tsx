'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  getInventoryReport,
  getMovementsReport,
  getLowStockReport,
  lockDevice,
  type InventoryReportModelRow,
  type LowStockModel,
} from '@/lib/api/devices';
import {
  getDeviceLoanChain,
  getLockEffectiveness,
  type DeviceLoanChainRow,
  type DeviceLoanChainFilters,
  type LockEffectivenessResponse,
} from '@/lib/api/reports';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/shared/Pagination';
import { DateRangeFilter } from '@/components/reports/date-range-filter';
import type { DateRange } from '@/types/reports';
import { formatCurrency, formatDateTime } from '@lynia/utils';
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Clock,
  XCircle,
  Link2,
  Search,
  Lock,
  Download,
  Loader2,
  Shield,
  Info,
} from 'lucide-react';

type Tab = 'overview' | 'movements' | 'low-stock' | 'device-loan-chain' | 'lock-effectiveness';
type ChainView = 'collections' | 'audit';

export default function InventoryReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [movementDays, setMovementDays] = useState(30);

  // Device-Loan Chain state
  const [chainView, setChainView] = useState<ChainView>('collections');
  const [chainSearch, setChainSearch] = useState('');
  const [chainSearchDebounced, setChainSearchDebounced] = useState('');
  const [chainLockStatus, setChainLockStatus] = useState('');
  const [chainLoanStatus, setChainLoanStatus] = useState('');
  const [chainPage, setChainPage] = useState(1);
  const [chainDateRange, setChainDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
    preset: '90d',
  });
  const [lockingDeviceId, setLockingDeviceId] = useState<string | null>(null);

  // Lock Effectiveness state
  const [lockEffDateRange, setLockEffDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
    preset: '30d',
  });
  const handleLockEffDateChange = useCallback((range: DateRange) => {
    setLockEffDateRange(range);
  }, []);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const queryClient = useQueryClient();

  // Debounce search input
  useEffect(() => {
    searchTimeoutRef.current = setTimeout(() => {
      setChainSearchDebounced(chainSearch);
      setChainPage(1);
    }, 400);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [chainSearch]);

  // Reset page on filter change
  const handleChainViewChange = useCallback((v: ChainView) => {
    setChainView(v);
    setChainPage(1);
  }, []);
  const handleChainLockStatusChange = useCallback((v: string) => {
    setChainLockStatus(v);
    setChainPage(1);
  }, []);
  const handleChainLoanStatusChange = useCallback((v: string) => {
    setChainLoanStatus(v);
    setChainPage(1);
  }, []);
  const handleChainDateChange = useCallback((range: DateRange) => {
    setChainDateRange(range);
    setChainPage(1);
  }, []);

  const chainFilters: DeviceLoanChainFilters = useMemo(() => ({
    view: chainView,
    search: chainSearchDebounced || undefined,
    lock_status: chainLockStatus || undefined,
    loan_status: chainLoanStatus || undefined,
    date_from: chainDateRange.from,
    date_to: chainDateRange.to,
    page: chainPage,
    limit: 25,
  }), [chainView, chainSearchDebounced, chainLockStatus, chainLoanStatus, chainDateRange, chainPage]);

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

  const {
    data: chainData,
    isLoading: chainLoading,
    isError: chainError,
  } = useQuery({
    queryKey: ['device-loan-chain', chainFilters],
    queryFn: () => getDeviceLoanChain(chainFilters),
    enabled: activeTab === 'device-loan-chain',
  });

  // Lock Effectiveness query
  const {
    data: lockEffData,
    isLoading: lockEffLoading,
    isError: lockEffError,
  } = useQuery({
    queryKey: ['lock-effectiveness', lockEffDateRange.from, lockEffDateRange.to],
    queryFn: () => getLockEffectiveness({ date_from: lockEffDateRange.from, date_to: lockEffDateRange.to }),
    enabled: activeTab === 'lock-effectiveness',
  });

  // Lock device mutation
  const lockMutation = useMutation({
    mutationFn: (deviceId: string) =>
      lockDevice(deviceId, '', 'Overdue loan - locked via collections'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-loan-chain'] });
      setLockingDeviceId(null);
    },
    onError: () => {
      setLockingDeviceId(null);
    },
  });

  const handleLockDevice = useCallback(
    (deviceId: string) => {
      setLockingDeviceId(deviceId);
      lockMutation.mutate(deviceId);
    },
    [lockMutation]
  );

  // CSV export
  const handleExportCsv = useCallback(() => {
    const params = new URLSearchParams();
    if (chainFilters.view) params.set('view', chainFilters.view);
    if (chainFilters.search) params.set('search', chainFilters.search);
    if (chainFilters.lock_status) params.set('lock_status', chainFilters.lock_status);
    if (chainFilters.loan_status) params.set('loan_status', chainFilters.loan_status);
    if (chainFilters.date_from) params.set('date_from', chainFilters.date_from);
    if (chainFilters.date_to) params.set('date_to', chainFilters.date_to);
    params.set('export', 'csv');
    params.set('limit', '10000');

    // Use the API base to trigger CSV download
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    window.open(`${apiBase}/api/v1/reports/device-loan-chain?${params.toString()}`, '_blank');
  }, [chainFilters]);

  // Lock status badge helper
  const lockStatusBadge = (status: string) => {
    switch (status) {
      case 'locked':
        return <Badge variant="status" status="failed">Locked</Badge>;
      case 'unlocked':
        return <Badge variant="status" status="active">Unlocked</Badge>;
      case 'pending':
        return <Badge variant="status" status="pending">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Loan status badge helper
  const loanStatusBadge = (status: string | null) => {
    if (!status) return <span className="text-xs text-muted-foreground">-</span>;
    switch (status) {
      case 'active':
      case 'disbursed':
        return <Badge variant="status" status="active">{status}</Badge>;
      case 'defaulted':
        return <Badge variant="status" status="failed">{status}</Badge>;
      case 'paid_off':
        return <Badge variant="status" status="completed">{status}</Badge>;
      case 'pending':
      case 'approved':
        return <Badge variant="status" status="pending">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Payment status badge helper
  const paymentStatusBadge = (status: string | null) => {
    if (!status) return <span className="text-xs text-muted-foreground">-</span>;
    switch (status) {
      case 'confirmed':
        return <Badge variant="status" status="completed">Confirmed</Badge>;
      case 'pending':
        return <Badge variant="status" status="pending">Pending</Badge>;
      case 'failed':
        return <Badge variant="status" status="failed">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const chainColumns: Column<DeviceLoanChainRow>[] = [
    {
      key: 'imei',
      header: 'Device',
      render: (row) => (
        <div>
          <p className="font-mono text-sm font-medium">{row.imei}</p>
          <p className="text-xs text-muted-foreground">
            {row.manufacturer} {row.model}
          </p>
        </div>
      ),
    },
    {
      key: 'lock_status',
      header: 'Lock',
      render: (row) => lockStatusBadge(row.lock_status),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      render: (row) =>
        row.customer_name ? (
          <div>
            <p className="text-sm font-medium">{row.customer_name}</p>
            <p className="text-xs text-muted-foreground">{row.phone_number || '-'}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No customer</span>
        ),
    },
    {
      key: 'loan_status',
      header: 'Loan',
      render: (row) =>
        row.loan_id ? (
          <div>
            {loanStatusBadge(row.loan_status)}
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {row.loan_number}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No loan</span>
        ),
    },
    {
      key: 'outstanding_balance_usd',
      header: 'Outstanding',
      sortable: true,
      render: (row) =>
        row.outstanding_balance_usd !== null ? (
          <span className="text-sm font-medium">
            {formatCurrency(row.outstanding_balance_usd)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    {
      key: 'days_past_due',
      header: 'DPD',
      sortable: true,
      render: (row) => {
        const dpd = row.days_past_due;
        if (!dpd || dpd === 0)
          return <span className="text-sm text-muted-foreground">0</span>;
        const color =
          dpd > 90
            ? 'text-red-700 bg-red-50'
            : dpd > 30
            ? 'text-orange-700 bg-orange-50'
            : 'text-amber-700 bg-amber-50';
        return (
          <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${color}`}
          >
            {dpd}d
          </span>
        );
      },
    },
    {
      key: 'last_payment_status',
      header: 'Last Payment',
      render: (row) => (
        <div>
          {paymentStatusBadge(row.last_payment_status)}
          {row.last_payment_date && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(row.last_payment_date)}
            </p>
          )}
        </div>
      ),
    },
    ...(chainView === 'collections'
      ? [
          {
            key: 'actions' as const,
            header: 'Action',
            render: (row: DeviceLoanChainRow) => {
              if (row.lock_status === 'locked') {
                return (
                  <span className="text-xs text-muted-foreground">Already locked</span>
                );
              }
              if (row.days_past_due > 0 && row.loan_id) {
                const isLocking = lockingDeviceId === row.device_id;
                return (
                  <Button
                    size="sm"
                    variant="danger"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={isLocking}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLockDevice(row.device_id);
                    }}
                  >
                    {isLocking ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Lock className="h-3 w-3" />
                    )}
                    Lock
                  </Button>
                );
              }
              return null;
            },
          } satisfies Column<DeviceLoanChainRow>,
        ]
      : []),
  ];

  const modelColumns: Column<InventoryReportModelRow>[] = [
    {
      key: 'manufacturer',
      header: 'Model',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.manufacturer} {row.model_name}</p>
          <p className="text-xs text-muted-foreground">{row.total_units} total units</p>
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
          <p className="text-xs text-muted-foreground">{formatCurrency(row.retail_price_usd)} retail</p>
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
        <span className="text-sm text-muted-foreground">
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
    { key: 'device-loan-chain', label: 'Device-Loan Chain', icon: <Link2 className="h-4 w-4" /> },
    { key: 'lock-effectiveness', label: 'Lock Effectiveness', icon: <Shield className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/devices" className="rounded-md p-1 hover:bg-accent">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Reports</h1>
          <p className="text-sm text-muted-foreground">Stock levels, movements, and low-stock alerts</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
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
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-2">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Devices</p>
                    <p className="text-lg font-semibold">{report.totals.total_devices}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 dark:bg-green-950 p-2">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">In Stock</p>
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
                    <p className="text-sm text-muted-foreground">Available Value</p>
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
                    <p className="text-sm text-muted-foreground">Damaged/Lost</p>
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
                      <p className="text-sm font-medium text-foreground">{bucket.age_bracket}</p>
                      <p className="text-lg font-semibold">{bucket.count} units</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(bucket.value)}</p>
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
            <span className="text-sm text-muted-foreground">Period:</span>
            {[7, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setMovementDays(d)}
                className={`rounded-md px-3 py-1 text-sm ${
                  movementDays === d
                    ? 'bg-brand-100 text-brand-700 font-medium'
                    : 'text-muted-foreground hover:bg-accent'
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
                  <p className="text-sm capitalize text-muted-foreground">
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
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
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
                          <p className="font-mono text-xs text-muted-foreground">{m.device_imei}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {m.from_status && m.to_status
                            ? `${m.from_status} \u2192 ${m.to_status}`
                            : m.to_status || '-'}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No movements in this period</p>
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
            <Card className="border-red-200 bg-red-50 dark:bg-red-950 p-4">
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
                        <p className="text-xs text-muted-foreground">{formatCurrency(model.retail_price_usd)} retail</p>
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

      {/* Lock Effectiveness Tab */}
      {activeTab === 'lock-effectiveness' && (
        <div className="space-y-6">
          {/* Date filter */}
          <div className="flex items-end gap-4">
            <div>
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Date Range
              </label>
              <DateRangeFilter
                value={lockEffDateRange}
                onChange={handleLockEffDateChange}
              />
            </div>
          </div>

          {/* Info banner */}
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This report requires data accumulation. Results become meaningful after lock events
                are tracked for several weeks. It correlates device lock events with subsequent
                customer payments to measure lock effectiveness as a collections tool.
              </p>
            </div>
          </Card>

          {/* Error state */}
          {lockEffError && (
            <Card className="border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">
                Failed to load lock effectiveness data. Please try again.
              </p>
            </Card>
          )}

          {/* Loading state */}
          {lockEffLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="h-16 animate-pulse rounded bg-muted" />
                </Card>
              ))}
            </div>
          )}

          {/* KPI cards */}
          {lockEffData && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-50 dark:bg-purple-950 p-2">
                      <Lock className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Locks</p>
                      <p className="text-lg font-semibold">{lockEffData.summary.total_locks}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-50 dark:bg-green-950 p-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Conversion Rate (30d)</p>
                      <p className="text-lg font-semibold">
                        {lockEffData.summary.total_locks > 0
                          ? `${((lockEffData.summary.paid_within_30d / lockEffData.summary.total_locks) * 100).toFixed(1)}%`
                          : '-'}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Hours to Payment</p>
                      <p className="text-lg font-semibold">
                        {lockEffData.summary.avg_hours_to_payment !== null
                          ? `${lockEffData.summary.avg_hours_to_payment.toFixed(1)}h`
                          : '-'}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Paid within 48h</p>
                      <p className="text-lg font-semibold">{lockEffData.summary.paid_within_48h}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Detailed breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment Recovery Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-medium text-foreground">Within 48 hours</p>
                      <p className="text-lg font-semibold">{lockEffData.summary.paid_within_48h}</p>
                      <p className="text-xs text-muted-foreground">
                        {lockEffData.summary.total_locks > 0
                          ? `${((lockEffData.summary.paid_within_48h / lockEffData.summary.total_locks) * 100).toFixed(1)}%`
                          : '0%'}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-medium text-foreground">Within 7 days</p>
                      <p className="text-lg font-semibold">{lockEffData.summary.paid_within_7d}</p>
                      <p className="text-xs text-muted-foreground">
                        {lockEffData.summary.total_locks > 0
                          ? `${((lockEffData.summary.paid_within_7d / lockEffData.summary.total_locks) * 100).toFixed(1)}%`
                          : '0%'}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-medium text-foreground">Within 30 days</p>
                      <p className="text-lg font-semibold">{lockEffData.summary.paid_within_30d}</p>
                      <p className="text-xs text-muted-foreground">
                        {lockEffData.summary.total_locks > 0
                          ? `${((lockEffData.summary.paid_within_30d / lockEffData.summary.total_locks) * 100).toFixed(1)}%`
                          : '0%'}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-medium text-foreground">Paid Eventually</p>
                      <p className="text-lg font-semibold">{lockEffData.summary.paid_eventually}</p>
                      <p className="text-xs text-muted-foreground">
                        {lockEffData.summary.total_locks > 0
                          ? `${((lockEffData.summary.paid_eventually / lockEffData.summary.total_locks) * 100).toFixed(1)}%`
                          : '0%'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Monthly trend */}
              {lockEffData.trend.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Monthly Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-2 pr-4 font-medium text-muted-foreground">Month</th>
                            <th className="pb-2 pr-4 font-medium text-muted-foreground">Total Locks</th>
                            <th className="pb-2 pr-4 font-medium text-muted-foreground">Paid within 30d</th>
                            <th className="pb-2 font-medium text-muted-foreground">Conversion Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lockEffData.trend.map((row) => (
                            <tr key={row.month} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-medium">{row.month}</td>
                              <td className="py-2 pr-4">{row.total_locks}</td>
                              <td className="py-2 pr-4">{row.paid_within_30d}</td>
                              <td className="py-2">
                                <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                                  row.conversion_rate >= 50
                                    ? 'bg-green-50 text-green-700'
                                    : row.conversion_rate >= 25
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-red-50 text-red-700'
                                }`}>
                                  {row.conversion_rate.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Device-Loan Chain Tab */}
      {activeTab === 'device-loan-chain' && (
        <div className="space-y-4">
          {/* Sub-view toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex rounded-lg border bg-muted/50 p-0.5">
              {(['collections', 'audit'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => handleChainViewChange(v)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    chainView === v
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {v === 'collections' ? 'Collections' : 'Audit Trail'}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Search */}
              <div className="min-w-[240px] flex-1">
                <label htmlFor="chain-search" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    id="chain-search"
                    type="text"
                    placeholder="IMEI, name, national ID, loan number..."
                    value={chainSearch}
                    onChange={(e) => setChainSearch(e.target.value)}
                    className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Lock Status */}
              <div>
                <label htmlFor="chain-lock-status" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Lock Status
                </label>
                <select
                  id="chain-lock-status"
                  value={chainLockStatus}
                  onChange={(e) => handleChainLockStatusChange(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All</option>
                  <option value="locked">Locked</option>
                  <option value="unlocked">Unlocked</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Loan Status */}
              <div>
                <label htmlFor="chain-loan-status" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Loan Status
                </label>
                <select
                  id="chain-loan-status"
                  value={chainLoanStatus}
                  onChange={(e) => handleChainLoanStatusChange(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="disbursed">Disbursed</option>
                  <option value="defaulted">Defaulted</option>
                  <option value="paid_off">Paid Off</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Date Range */}
              <div>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Date Range
                </label>
                <DateRangeFilter
                  value={chainDateRange}
                  onChange={handleChainDateChange}
                />
              </div>
            </div>
          </Card>

          {/* Error state */}
          {chainError && (
            <Card className="border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">
                Failed to load device-loan chain data. Please try again.
              </p>
            </Card>
          )}

          {/* Data Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>
                  {chainView === 'collections'
                    ? 'Overdue Device-Loan Chains'
                    : 'All Device-Loan Chains'}
                </span>
                {chainData && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {chainData.total} result{chainData.total !== 1 ? 's' : ''}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={chainColumns}
                data={chainData?.data || []}
                keyExtractor={(row) => row.device_id}
                loading={chainLoading}
                emptyMessage={
                  chainView === 'collections'
                    ? 'No overdue device-loan chains found'
                    : 'No device-loan chains found'
                }
              />
              {chainData && chainData.total > 0 && (
                <Pagination
                  page={chainData.page}
                  limit={chainData.limit}
                  total={chainData.total}
                  onPageChange={setChainPage}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
