'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouteId } from '@/hooks/use-route-id';
import {
  getDistributor,
  updateDistributor,
  getDistributorInventory,
  getDistributorHandovers,
  getDistributorTransfers,
  getDistributorCommissions,
  bulkPayCommissions,
} from '@/lib/api/distributors';
import { createTransfer, updateTransferStatus } from '@/lib/api/devices';
import { DistributorForm } from '@/components/distributors/distributor-form';
import { DeviceSearch } from '@/components/devices/DeviceSearch';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatDateTime } from '@lynia/utils';
import {
  ArrowLeft,
  Edit2,
  Package,
  DollarSign,
  HandCoins,
  Truck,
  Search,
  Download,
  Plus,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  Ban,
  Power,
} from 'lucide-react';
import type {
  Distributor,
  CreateDistributorInput,
  DistributorInventoryItem,
  DistributorHandover,
  DistributorTransfer,
  DistributorCommission,
} from '@/types';

// ─── Helpers ───

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Tab type ───

type TabKey = 'inventory' | 'handovers' | 'transfers' | 'commissions';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'inventory', label: 'Inventory', icon: <Package className="mr-1.5 h-4 w-4" /> },
  { key: 'handovers', label: 'Handovers', icon: <HandCoins className="mr-1.5 h-4 w-4" /> },
  { key: 'transfers', label: 'Transfers', icon: <Truck className="mr-1.5 h-4 w-4" /> },
  { key: 'commissions', label: 'Commissions', icon: <DollarSign className="mr-1.5 h-4 w-4" /> },
];

// ─── Status configs ───

const handoverStatusConfig: Record<string, { label: string; variant: string }> = {
  initiated: { label: 'Initiated', variant: 'yellow' },
  identity_verified: { label: 'ID Verified', variant: 'blue' },
  deposit_verified: { label: 'Deposit Verified', variant: 'blue' },
  device_inspected: { label: 'Inspected', variant: 'blue' },
  completed: { label: 'Completed', variant: 'green' },
  cancelled: { label: 'Cancelled', variant: 'red' },
};

const TRANSFER_STATUS_BADGE: Record<string, string> = {
  requested: 'pending',
  approved: 'active',
  in_transit: 'in_transit',
  received: 'completed',
  cancelled: 'failed',
};

// ─── Main component ───

export default function DistributorDetailPage() {
  const id = useRouteId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ─── Top-level state ───
  const [activeTab, setActiveTab] = useState<TabKey>('inventory');
  const [editModal, setEditModal] = useState(false);
  const [suspendConfirmOpen, setSuspendConfirmOpen] = useState(false);

  // ─── Inventory state ───
  const [invSearch, setInvSearch] = useState('');
  const [invStatus, setInvStatus] = useState('');
  const [invPage, setInvPage] = useState(1);
  const [allocateModal, setAllocateModal] = useState(false);
  const [pendingAllocateDevice, setPendingAllocateDevice] = useState<{ id: string; imei: string; model_name: string } | null>(null);

  // ─── Handovers state ───
  const [hoStatus, setHoStatus] = useState('');
  const [hoSearch, setHoSearch] = useState('');
  const [hoPage, setHoPage] = useState(1);

  // ─── Transfers state ───
  const [trStatus, setTrStatus] = useState('');
  const [trPage, setTrPage] = useState(1);
  const [newTransferModal, setNewTransferModal] = useState(false);
  const [pendingTransferDevice, setPendingTransferDevice] = useState<{ id: string; imei: string; model_name: string } | null>(null);
  const [returnModal, setReturnModal] = useState(false);
  const [pendingReturnDevice, setPendingReturnDevice] = useState<DistributorInventoryItem | null>(null);
  const [actionTransfer, setActionTransfer] = useState<DistributorTransfer | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // ─── Commissions state ───
  const [comPage, setComPage] = useState(1);
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);
  const [confirmBulkPay, setConfirmBulkPay] = useState(false);

  // ─── Queries ───

  const { data: distributor, isLoading } = useQuery({
    queryKey: ['distributor', id],
    queryFn: () => getDistributor(id),
    enabled: !!id,
  });

  const { data: inventoryData, isLoading: invLoading, isError: invError } = useQuery({
    queryKey: ['distributor-inventory', id, invSearch, invStatus, invPage],
    queryFn: () =>
      getDistributorInventory(id, {
        search: invSearch || undefined,
        status: invStatus || undefined,
        page: invPage,
      }),
    enabled: !!id && activeTab === 'inventory',
  });

  const { data: handoverData, isLoading: hoLoading, isError: hoError } = useQuery({
    queryKey: ['distributor-handovers', id, hoStatus, hoSearch, hoPage],
    queryFn: () =>
      getDistributorHandovers(id, {
        status: hoStatus || undefined,
        search: hoSearch || undefined,
        page: hoPage,
      }),
    enabled: !!id && activeTab === 'handovers',
  });

  const { data: transferData, isLoading: trLoading, isError: trError } = useQuery({
    queryKey: ['distributor-transfers', id, trStatus, trPage],
    queryFn: () =>
      getDistributorTransfers(id, {
        status: trStatus || undefined,
        page: trPage,
      }),
    enabled: !!id && activeTab === 'transfers',
  });

  const { data: commissionData, isLoading: comLoading, isError: comError } = useQuery({
    queryKey: ['distributor-commissions', id, comPage],
    queryFn: () => getDistributorCommissions(id, { page: comPage }),
    enabled: !!id && activeTab === 'commissions',
  });

  // ─── Mutations ───

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateDistributorInput>) => updateDistributor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributor', id] });
      toast({ title: 'Distributor updated', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update distributor', description: error.message, variant: 'error' });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (newStatus: 'suspended' | 'active') => updateDistributor(id, { status: newStatus }),
    onSuccess: (_data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['distributor', id] });
      setSuspendConfirmOpen(false);
      toast({
        title: newStatus === 'suspended' ? 'Distributor suspended' : 'Distributor activated',
        description: newStatus === 'suspended'
          ? `${distributor?.business_name} has been suspended.`
          : `${distributor?.business_name} has been activated.`,
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update distributor status', description: error.message, variant: 'error' });
    },
  });

  const allocateMutation = useMutation({
    mutationFn: (deviceId: string) =>
      createTransfer({
        device_id: deviceId,
        to_distributor_id: id,
        to_location: distributor?.city || undefined,
        auto_approve: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributor-inventory', id] });
      queryClient.invalidateQueries({ queryKey: ['distributor', id] });
      setAllocateModal(false);
      setPendingAllocateDevice(null);
      toast({ title: 'Device allocated successfully', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to allocate device', description: error.message, variant: 'error' });
    },
  });

  const transferMutation = useMutation({
    mutationFn: (deviceId: string) =>
      createTransfer({
        device_id: deviceId,
        to_distributor_id: id,
        to_location: distributor?.city || undefined,
        auto_approve: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributor-transfers', id] });
      queryClient.invalidateQueries({ queryKey: ['distributor-inventory', id] });
      queryClient.invalidateQueries({ queryKey: ['distributor', id] });
      setNewTransferModal(false);
      setPendingTransferDevice(null);
      toast({ title: 'Transfer created', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create transfer', description: error.message, variant: 'error' });
    },
  });

  const returnMutation = useMutation({
    mutationFn: (deviceId: string) =>
      createTransfer({
        device_id: deviceId,
        from_distributor_id: id,
        from_location: distributor?.city || undefined,
        to_location: 'Warehouse',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributor-transfers', id] });
      queryClient.invalidateQueries({ queryKey: ['distributor-inventory', id] });
      queryClient.invalidateQueries({ queryKey: ['distributor', id] });
      setReturnModal(false);
      setPendingReturnDevice(null);
      toast({ title: 'Return transfer created', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create return transfer', description: error.message, variant: 'error' });
    },
  });

  const updateTransferMutation = useMutation({
    mutationFn: ({ transferId, status, reason }: { transferId: string; status: string; reason?: string }) =>
      updateTransferStatus(transferId, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributor-transfers', id] });
      queryClient.invalidateQueries({ queryKey: ['distributor-inventory', id] });
      queryClient.invalidateQueries({ queryKey: ['distributor', id] });
      setActionTransfer(null);
      setCancelReason('');
      toast({ title: 'Transfer updated', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update transfer', description: error.message, variant: 'error' });
    },
  });

  const bulkPayMutation = useMutation({
    mutationFn: () => bulkPayCommissions(id, selectedCommissions),
    onSuccess: () => {
      const paidCount = selectedCommissions.length;
      const paidTotal = commissionData?.data
        ?.filter((c) => selectedCommissions.includes(c.id))
        .reduce((sum, c) => sum + (c.commission_amount_usd || 0), 0) || 0;
      setSelectedCommissions([]);
      setConfirmBulkPay(false);
      queryClient.invalidateQueries({ queryKey: ['distributor-commissions', id] });
      queryClient.invalidateQueries({ queryKey: ['distributor', id] });
      toast({
        title: 'Commissions paid successfully',
        description: `Successfully paid ${paidCount} commission${paidCount !== 1 ? 's' : ''} totaling $${paidTotal.toFixed(2)}`,
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to pay commissions', description: error.message, variant: 'error' });
    },
  });

  // ─── Transfer action helpers ───

  const getTransferActions = (status: string) => {
    switch (status) {
      case 'requested':
        return [
          { label: 'Approve', value: 'approved', icon: <Check className="mr-1.5 h-4 w-4" /> },
          { label: 'Cancel', value: 'cancelled', variant: 'danger' as const, icon: <X className="mr-1.5 h-4 w-4" /> },
        ];
      case 'approved':
        return [
          { label: 'Mark In Transit', value: 'in_transit', icon: <Truck className="mr-1.5 h-4 w-4" /> },
          { label: 'Cancel', value: 'cancelled', variant: 'danger' as const, icon: <X className="mr-1.5 h-4 w-4" /> },
        ];
      case 'in_transit':
        return [
          { label: 'Mark Received', value: 'received', icon: <Check className="mr-1.5 h-4 w-4" /> },
          { label: 'Cancel', value: 'cancelled', variant: 'danger' as const, icon: <X className="mr-1.5 h-4 w-4" /> },
        ];
      default:
        return [];
    }
  };

  // ─── CSV Export helpers ───

  function exportInventoryCSV() {
    if (!inventoryData?.data) return;
    downloadCSV(
      `distributor-inventory-${id}.csv`,
      ['IMEI', 'Manufacturer', 'Model', 'Condition', 'Retail Price', 'Status', 'Assigned Date', 'Sold Date'],
      inventoryData.data.map((item) => [
        item.imei,
        item.manufacturer,
        item.model,
        item.condition,
        (item.retail_price_usd || 0).toFixed(2),
        item.status,
        item.assigned_date || '',
        item.sold_date || '',
      ])
    );
  }

  function exportHandoversCSV() {
    if (!handoverData?.data) return;
    downloadCSV(
      `distributor-handovers-${id}.csv`,
      ['Customer', 'Phone', 'Device Model', 'IMEI', 'Status', 'Scheduled Date', 'Completed At', 'Created'],
      handoverData.data.map((h) => [
        h.customer_name,
        h.customer_phone,
        h.device_model,
        h.device_imei,
        h.status,
        h.scheduled_date || '',
        h.completed_at || '',
        h.created_at,
      ])
    );
  }

  function exportTransfersCSV() {
    if (!transferData?.data) return;
    downloadCSV(
      `distributor-transfers-${id}.csv`,
      ['Device Model', 'IMEI', 'From', 'To', 'Status', 'Requested By', 'Date'],
      transferData.data.map((t) => [
        `${t.manufacturer} ${t.device_model}`,
        t.device_imei,
        t.from_distributor_name || t.from_location || '',
        t.to_distributor_name || t.to_location || '',
        t.status,
        t.requested_by_name || '',
        t.created_at,
      ])
    );
  }

  function exportCommissionsCSV() {
    if (!commissionData?.data) return;
    downloadCSV(
      `distributor-commissions-${id}.csv`,
      ['Device Model', 'IMEI', 'Amount', 'Percentage', 'Retail Price', 'Status', 'Date'],
      commissionData.data.map((c) => [
        c.device_model || '',
        c.device_imei || '',
        (c.commission_amount_usd || 0).toFixed(2),
        `${(c.commission_percentage || 0).toFixed(1)}%`,
        (c.device_retail_price_usd || 0).toFixed(2),
        c.payment_status,
        c.created_at,
      ])
    );
  }

  // ─── Tab error/skeleton helpers ───

  function TabErrorBanner({ message }: { message: string }) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-4 dark:border-red-800 dark:bg-red-950">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
        <p className="text-sm text-red-800 dark:text-red-200">{message}</p>
      </div>
    );
  }

  function TabControlsSkeleton({ items = 3 }: { items?: number }) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  function CommissionSummarySkeleton() {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-muted mb-2" />
            <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  // ─── Column definitions ───

  const inventoryColumns: Column<DistributorInventoryItem>[] = [
    {
      key: 'imei',
      header: 'IMEI',
      render: (row) => <span className="font-mono text-sm">{row.imei}</span>,
    },
    {
      key: 'model',
      header: 'Model',
      render: (row) => (
        <span className="text-sm">
          {row.manufacturer} {row.model}
        </span>
      ),
    },
    {
      key: 'condition',
      header: 'Condition',
      render: (row) => (
        <Badge variant="status" status={row.condition}>
          {row.condition.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'retail_price_usd',
      header: 'Retail Price',
      render: (row) => <span className="text-sm">${(row.retail_price_usd || 0).toFixed(2)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const statusVariant: Record<string, 'green' | 'blue' | 'gray' | 'red'> = {
          available: 'green',
          sold: 'blue',
          returned: 'gray',
          damaged: 'red',
        };
        return (
          <Badge variant={statusVariant[row.status] || 'default'}>
            {row.status.replace(/_/g, ' ')}
          </Badge>
        );
      },
    },
    {
      key: 'assigned_date',
      header: 'Assigned Date',
      render: (row) => <span className="text-sm text-muted-foreground">{row.assigned_date ? formatDate(row.assigned_date) : '-'}</span>,
    },
    {
      key: 'sold_date',
      header: 'Sold Date',
      render: (row) => <span className="text-sm text-muted-foreground">{row.sold_date ? formatDate(row.sold_date) : '-'}</span>,
    },
  ];

  const handoverColumns: Column<DistributorHandover>[] = [
    {
      key: 'customer_name',
      header: 'Customer',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.customer_name}</p>
          <p className="text-xs text-muted-foreground">{row.customer_phone}</p>
        </div>
      ),
    },
    {
      key: 'device_model',
      header: 'Device',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.device_model}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.device_imei}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const config = handoverStatusConfig[row.status];
        return (
          <Badge variant={(config?.variant as 'green' | 'blue' | 'yellow' | 'red') || 'default'}>
            {config?.label || row.status.replace(/_/g, ' ')}
          </Badge>
        );
      },
    },
    {
      key: 'scheduled_date',
      header: 'Scheduled Date',
      render: (row) => <span className="text-sm text-muted-foreground">{row.scheduled_date ? formatDate(row.scheduled_date) : '-'}</span>,
    },
    {
      key: 'completed_at',
      header: 'Completed At',
      render: (row) => <span className="text-sm text-muted-foreground">{row.completed_at ? formatDateTime(row.completed_at) : '-'}</span>,
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span>,
    },
  ];

  const transferColumns: Column<DistributorTransfer>[] = [
    {
      key: 'device_imei',
      header: 'Device',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.manufacturer} {row.device_model}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.device_imei}</p>
        </div>
      ),
    },
    {
      key: 'from_distributor_name',
      header: 'From',
      render: (row) => (
        <div className="text-sm">
          <p className="font-medium">{row.from_distributor_name || '-'}</p>
          {row.from_location && <p className="text-xs text-muted-foreground">{row.from_location}</p>}
        </div>
      ),
    },
    {
      key: 'to_distributor_name',
      header: 'To',
      render: (row) => (
        <div className="text-sm">
          <p className="font-medium">{row.to_distributor_name || '-'}</p>
          {row.to_location && <p className="text-xs text-muted-foreground">{row.to_location}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant="status" status={TRANSFER_STATUS_BADGE[row.status] || row.status}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'requested_by_name',
      header: 'Requested By',
      render: (row) => <span className="text-sm text-muted-foreground">{row.requested_by_name || '-'}</span>,
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => <span className="text-sm text-muted-foreground">{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'id',
      header: '',
      render: (row) => {
        const actions = getTransferActions(row.status);
        return actions.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setActionTransfer(row)}>
            Update
          </Button>
        ) : null;
      },
    },
  ];

  const commissionColumns: Column<DistributorCommission>[] = [
    {
      key: 'checkbox',
      header: '',
      className: 'w-10',
      render: (row) =>
        row.payment_status === 'pending' ? (
          <input
            type="checkbox"
            checked={selectedCommissions.includes(row.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedCommissions((prev) => [...prev, row.id]);
              } else {
                setSelectedCommissions((prev) => prev.filter((cid) => cid !== row.id));
              }
            }}
            className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
          />
        ) : null,
    },
    {
      key: 'device_model',
      header: 'Device',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.device_model || '-'}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.device_imei || '-'}</p>
        </div>
      ),
    },
    {
      key: 'commission_amount_usd',
      header: 'Amount',
      render: (row) => <span className="text-sm font-medium">${(row.commission_amount_usd || 0).toFixed(2)}</span>,
    },
    {
      key: 'commission_percentage',
      header: 'Percentage',
      render: (row) => <span className="text-sm">{(row.commission_percentage || 0).toFixed(1)}%</span>,
    },
    {
      key: 'device_retail_price_usd',
      header: 'Retail Price',
      render: (row) => <span className="text-sm">${(row.device_retail_price_usd || 0).toFixed(2)}</span>,
    },
    {
      key: 'payment_status',
      header: 'Payment Status',
      render: (row) => {
        const variant: Record<string, 'green' | 'yellow' | 'red'> = {
          paid: 'green',
          pending: 'yellow',
          cancelled: 'red',
        };
        return (
          <Badge variant={variant[row.payment_status] || 'default'}>
            {row.payment_status}
          </Badge>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span>,
    },
  ];

  // ─── Loading / Not found ───

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!distributor) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-muted-foreground">Distributor not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/distributors')}>
          Back to Distributors
        </Button>
      </div>
    );
  }

  // ─── Derived data ───

  const availableInventory = inventoryData?.data?.filter((item) => item.status === 'available') || [];

  const inputClass =
    'block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  // ─── Render ───

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push('/distributors')}
          className="mt-1 rounded-md p-1 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{distributor.business_name}</h1>
            <Badge variant="status" status={distributor.status}>
              {distributor.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{distributor.id}</p>
        </div>
        <div className="flex gap-2">
          {distributor.status === 'active' ? (
            <Button variant="outline" size="sm" onClick={() => setSuspendConfirmOpen(true)}>
              <Ban className="mr-1.5 h-4 w-4 text-red-500" />
              Suspend
            </Button>
          ) : distributor.status === 'suspended' ? (
            <Button variant="outline" size="sm" onClick={() => suspendMutation.mutate('active')}>
              <Power className="mr-1.5 h-4 w-4 text-green-500" />
              Activate
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setEditModal(true)}>
            <Edit2 className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Devices Sold</p>
              <p className="text-xl font-bold text-foreground">
                {distributor.total_devices_distributed || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-bold text-foreground">
                ${(distributor.total_commissions_earned || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inventory Count</p>
              <p className="text-xl font-bold text-foreground">
                {distributor.current_inventory_count || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-50 dark:bg-yellow-950">
              <HandCoins className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending Commissions</p>
              <p className="text-xl font-bold text-foreground">
                ${(distributor.pending_commissions || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Profile</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Contact */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Contact</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-muted-foreground">Contact Person</dt>
                <dd className="text-sm font-medium text-foreground">{distributor.name || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="text-sm font-medium text-foreground">{distributor.phone_number || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="text-sm font-medium text-foreground">{distributor.email || '-'}</dd>
              </div>
            </dl>
          </div>
          {/* Address */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Address</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-muted-foreground">Address</dt>
                <dd className="text-sm font-medium text-foreground">{distributor.address || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">City</dt>
                <dd className="text-sm font-medium text-foreground">{distributor.city || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Province</dt>
                <dd className="text-sm font-medium text-foreground">{distributor.province || '-'}</dd>
              </div>
            </dl>
          </div>
          {/* Bank */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Bank</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-muted-foreground">Bank Name</dt>
                <dd className="text-sm font-medium text-foreground">{distributor.bank_name || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Account Number</dt>
                <dd className="text-sm font-medium text-foreground">{distributor.account_number || '-'}</dd>
              </div>
            </dl>
          </div>
          {/* Mobile Money */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Mobile Money</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-muted-foreground">EcoCash</dt>
                <dd className="text-sm font-medium text-foreground">{distributor.mobile_money_number || '-'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* ─── Inventory Tab ─── */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {invError && <TabErrorBanner message="Failed to load inventory. Please try again." />}

            {invLoading ? (
              <TabControlsSkeleton items={4} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={invSearch}
                    onChange={(e) => {
                      setInvSearch(e.target.value);
                      setInvPage(1);
                    }}
                    placeholder="Search by IMEI..."
                    className="block w-full rounded-lg border border-border py-2 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <select
                  value={invStatus}
                  onChange={(e) => {
                    setInvStatus(e.target.value);
                    setInvPage(1);
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="available">Available</option>
                  <option value="sold">Sold</option>
                  <option value="returned">Returned</option>
                  <option value="damaged">Damaged</option>
                </select>
                <Button onClick={() => setAllocateModal(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Allocate Device
                </Button>
                <Button variant="outline" onClick={exportInventoryCSV}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            )}

            <DataTable
              columns={inventoryColumns}
              data={inventoryData?.data || []}
              keyExtractor={(row) => row.id}
              loading={invLoading}
              emptyMessage="No inventory items found"
            />

            {inventoryData && inventoryData.total_pages > 1 && (
              <Pagination
                page={inventoryData.page}
                totalPages={inventoryData.total_pages}
                total={inventoryData.total}
                pageSize={inventoryData.limit}
                onPageChange={setInvPage}
              />
            )}
          </div>
        )}

        {/* ─── Handovers Tab ─── */}
        {activeTab === 'handovers' && (
          <div className="space-y-4">
            {hoError && <TabErrorBanner message="Failed to load handovers. Please try again." />}

            {hoLoading ? (
              <TabControlsSkeleton items={3} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={hoStatus}
                  onChange={(e) => {
                    setHoStatus(e.target.value);
                    setHoPage(1);
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="initiated">Initiated</option>
                  <option value="identity_verified">ID Verified</option>
                  <option value="deposit_verified">Deposit Verified</option>
                  <option value="device_inspected">Inspected</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={hoSearch}
                    onChange={(e) => {
                      setHoSearch(e.target.value);
                      setHoPage(1);
                    }}
                    placeholder="Search by customer or IMEI..."
                    className="block w-full rounded-lg border border-border py-2 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <Button variant="outline" onClick={exportHandoversCSV}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            )}

            <DataTable
              columns={handoverColumns}
              data={handoverData?.data || []}
              keyExtractor={(row) => row.id}
              loading={hoLoading}
              emptyMessage="No handovers found"
            />

            {handoverData && handoverData.total_pages > 1 && (
              <Pagination
                page={handoverData.page}
                totalPages={handoverData.total_pages}
                total={handoverData.total}
                pageSize={handoverData.limit}
                onPageChange={setHoPage}
              />
            )}
          </div>
        )}

        {/* ─── Transfers Tab ─── */}
        {activeTab === 'transfers' && (
          <div className="space-y-4">
            {trError && <TabErrorBanner message="Failed to load transfers. Please try again." />}

            {trLoading ? (
              <TabControlsSkeleton items={4} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={trStatus}
                  onChange={(e) => {
                    setTrStatus(e.target.value);
                    setTrPage(1);
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="requested">Requested</option>
                  <option value="approved">Approved</option>
                  <option value="in_transit">In Transit</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <div className="flex-1" />
                <Button onClick={() => setNewTransferModal(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  New Transfer
                </Button>
                <Button variant="outline" onClick={() => setReturnModal(true)}>
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Return to Warehouse
                </Button>
                <Button variant="outline" onClick={exportTransfersCSV}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            )}

            <DataTable
              columns={transferColumns}
              data={transferData?.data || []}
              keyExtractor={(row) => row.id}
              loading={trLoading}
              emptyMessage="No transfers found"
            />

            {transferData && transferData.total_pages > 1 && (
              <Pagination
                page={transferData.page}
                totalPages={transferData.total_pages}
                total={transferData.total}
                pageSize={transferData.limit}
                onPageChange={setTrPage}
              />
            )}
          </div>
        )}

        {/* ─── Commissions Tab ─── */}
        {activeTab === 'commissions' && (
          <div className="space-y-4">
            {comError && <TabErrorBanner message="Failed to load commissions. Please try again." />}

            {/* Summary */}
            {comLoading ? (
              <CommissionSummarySkeleton />
            ) : commissionData?.summary ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Total Earned</p>
                  <p className="text-xl font-bold text-foreground">
                    ${(commissionData.summary.total_earned || 0).toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="text-xl font-bold text-green-600">
                    ${(commissionData.summary.total_paid || 0).toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-xl font-bold text-yellow-600">
                    ${(commissionData.summary.pending || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Controls */}
            {comLoading ? (
              <TabControlsSkeleton items={2} />
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setConfirmBulkPay(true)}
                  disabled={selectedCommissions.length === 0}
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  Mark Selected as Paid ({selectedCommissions.length})
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={exportCommissionsCSV}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            )}

            <DataTable
              columns={commissionColumns}
              data={commissionData?.data || []}
              keyExtractor={(row) => row.id}
              loading={comLoading}
              emptyMessage="No commissions found"
            />

            {commissionData && commissionData.total_pages > 1 && (
              <Pagination
                page={commissionData.page}
                totalPages={commissionData.total_pages}
                total={commissionData.total}
                pageSize={commissionData.limit}
                onPageChange={setComPage}
              />
            )}
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}

      {/* Edit Distributor Modal */}
      <DistributorForm
        open={editModal}
        onClose={() => setEditModal(false)}
        onSubmit={async (data) => {
          await updateMutation.mutateAsync(data);
        }}
        initialData={distributor}
      />

      {/* Allocate Device Modal */}
      <Modal
        open={allocateModal}
        onClose={() => { setAllocateModal(false); setPendingAllocateDevice(null); }}
        title="Allocate Device to Distributor"
      >
        <div className="space-y-4">
          {!pendingAllocateDevice ? (
            <>
              <p className="text-sm text-muted-foreground">
                Search for a device by IMEI to allocate it to <strong>{distributor.business_name}</strong>.
              </p>
              <DeviceSearch
                onSelect={(device) => setPendingAllocateDevice(device)}
                placeholder="Search by IMEI to find device..."
              />
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setAllocateModal(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Allocate this device to <strong>{distributor.business_name}</strong>?
                The device will be immediately assigned to their inventory.
              </p>
              <dl className="rounded-lg border border-border bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">IMEI</dt>
                  <dd className="font-mono font-medium">{pendingAllocateDevice.imei}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Model</dt>
                  <dd className="font-medium">{pendingAllocateDevice.model_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Distributor</dt>
                  <dd className="font-medium">{distributor.business_name}</dd>
                </div>
              </dl>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingAllocateDevice(null)}>
                  Back
                </Button>
                <Button
                  onClick={() => allocateMutation.mutate(pendingAllocateDevice.id)}
                  disabled={allocateMutation.isPending}
                  isLoading={allocateMutation.isPending}
                >
                  {allocateMutation.isPending ? 'Allocating...' : 'Confirm Allocation'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* New Transfer Modal */}
      <Modal
        open={newTransferModal}
        onClose={() => { setNewTransferModal(false); setPendingTransferDevice(null); }}
        title="Transfer Device to Distributor"
      >
        <div className="space-y-4">
          {!pendingTransferDevice ? (
            <>
              <p className="text-sm text-muted-foreground">
                Search for a device by IMEI to transfer to <strong>{distributor.business_name}</strong>.
              </p>
              <DeviceSearch
                onSelect={(device) => setPendingTransferDevice(device)}
                placeholder="Search by IMEI to find device..."
              />
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setNewTransferModal(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Transfer this device to <strong>{distributor.business_name}</strong>?
                The device will be immediately assigned to their inventory.
              </p>
              <dl className="rounded-lg border border-border bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">IMEI</dt>
                  <dd className="font-mono font-medium">{pendingTransferDevice.imei}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Model</dt>
                  <dd className="font-medium">{pendingTransferDevice.model_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Distributor</dt>
                  <dd className="font-medium">{distributor.business_name}</dd>
                </div>
              </dl>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingTransferDevice(null)}>
                  Back
                </Button>
                <Button
                  onClick={() => transferMutation.mutate(pendingTransferDevice.id)}
                  disabled={transferMutation.isPending}
                  isLoading={transferMutation.isPending}
                >
                  {transferMutation.isPending ? 'Transferring...' : 'Confirm Transfer'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Return to Warehouse Modal */}
      <Modal
        open={returnModal}
        onClose={() => { setReturnModal(false); setPendingReturnDevice(null); }}
        title="Return Device to Warehouse"
        size="lg"
      >
        <div className="space-y-4">
          {!pendingReturnDevice ? (
            <>
              <p className="text-sm text-muted-foreground">
                Select a device currently assigned to <strong>{distributor.business_name}</strong> to return
                to the warehouse.
              </p>
              {availableInventory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No available devices in this distributor&apos;s inventory.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  {availableInventory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-accent border-b border-border last:border-0"
                      onClick={() => setPendingReturnDevice(item)}
                    >
                      <div className="text-left">
                        <p className="font-medium">
                          {item.manufacturer} {item.model}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">{item.imei}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        ${(item.retail_price_usd || 0).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setReturnModal(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Return this device from <strong>{distributor.business_name}</strong> to the warehouse?
              </p>
              <dl className="rounded-lg border border-border bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">IMEI</dt>
                  <dd className="font-mono font-medium">{pendingReturnDevice.imei}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Model</dt>
                  <dd className="font-medium">{pendingReturnDevice.manufacturer} {pendingReturnDevice.model}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Retail Price</dt>
                  <dd className="font-medium">${(pendingReturnDevice.retail_price_usd || 0).toFixed(2)}</dd>
                </div>
              </dl>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingReturnDevice(null)}>
                  Back
                </Button>
                <Button
                  onClick={() => returnMutation.mutate(pendingReturnDevice.device_id)}
                  disabled={returnMutation.isPending}
                  isLoading={returnMutation.isPending}
                >
                  {returnMutation.isPending ? 'Returning...' : 'Confirm Return'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Bulk Pay Commissions Confirmation */}
      <ConfirmationDialog
        open={confirmBulkPay}
        onClose={() => setConfirmBulkPay(false)}
        onConfirm={() => bulkPayMutation.mutate()}
        title="Confirm Commission Payment"
        description={
          <div className="space-y-3 text-left">
            <p>
              Mark <strong>{selectedCommissions.length}</strong> commission{selectedCommissions.length !== 1 ? 's' : ''} as paid
              for <strong>{distributor.business_name}</strong>?
            </p>
            {commissionData?.data && (
              <div className="rounded-lg border border-border bg-muted dark:border-gray-700 dark:bg-gray-800 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-bold text-foreground">
                    ${commissionData.data
                      .filter((c) => selectedCommissions.includes(c.id))
                      .reduce((sum, c) => sum + (c.commission_amount_usd || 0), 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. Commissions will be permanently marked as paid.
            </p>
          </div>
        }
        confirmLabel="Confirm Payment"
        variant="warning"
        isLoading={bulkPayMutation.isPending}
      />

      {/* Suspend Confirmation Dialog */}
      <ConfirmationDialog
        open={suspendConfirmOpen}
        onClose={() => setSuspendConfirmOpen(false)}
        onConfirm={() => suspendMutation.mutate('suspended')}
        title="Suspend Distributor"
        description={`Suspending ${distributor.business_name} will prevent login and freeze transactions. Are you sure you want to proceed?`}
        confirmLabel="Suspend"
        variant="destructive"
        isLoading={suspendMutation.isPending}
      />

      {/* Update Transfer Status Modal */}
      <Modal
        open={!!actionTransfer}
        onClose={() => {
          setActionTransfer(null);
          setCancelReason('');
        }}
        title="Update Transfer"
      >
        {actionTransfer && (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Device</dt>
                <dd className="font-medium">
                  {actionTransfer.manufacturer} {actionTransfer.device_model}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">IMEI</dt>
                <dd className="font-mono">{actionTransfer.device_imei}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">From</dt>
                <dd>
                  {actionTransfer.from_distributor_name || actionTransfer.from_location || '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">To</dt>
                <dd>
                  {actionTransfer.to_distributor_name || actionTransfer.to_location || '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Current Status</dt>
                <dd>
                  <Badge
                    variant="status"
                    status={TRANSFER_STATUS_BADGE[actionTransfer.status] || actionTransfer.status}
                  >
                    {actionTransfer.status.replace(/_/g, ' ')}
                  </Badge>
                </dd>
              </div>
            </dl>

            <div>
              <label htmlFor="transfer-cancellation-reason" className="block text-sm font-medium text-foreground">
                Cancellation Reason (if cancelling)
              </label>
              <textarea
                id="transfer-cancellation-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                className={inputClass + ' mt-1'}
                placeholder="Required if cancelling..."
              />
            </div>

            <div className="flex justify-end gap-2">
              {getTransferActions(actionTransfer.status).map((action) => (
                <Button
                  key={action.value}
                  variant={action.variant || 'primary'}
                  onClick={() =>
                    updateTransferMutation.mutate({
                      transferId: actionTransfer.id,
                      status: action.value,
                      reason: action.value === 'cancelled' ? cancelReason : undefined,
                    })
                  }
                  disabled={
                    updateTransferMutation.isPending ||
                    (action.value === 'cancelled' && !cancelReason.trim())
                  }
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
