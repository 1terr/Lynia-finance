'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import type { TransferListItem, SpotCheckInput } from '@/types/distributor';
import { fetchTransfers, confirmTransfer, rejectTransfer, requestReturn } from '@/lib/api/transfers';
import { fetchInventory } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/shared/pagination';
import { cn } from '@lynia/utils';
import { TransfersSkeleton } from '@/components/ui/skeleton';
import {
  ArrowLeftRight,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
  Truck,
  Search,
  Download,
} from 'lucide-react';

type TabId = 'pending' | 'returns' | 'history';

const PAGE_LIMIT = 20;

const STATUS_CONFIG: Record<string, {
  label: string;
  variant: 'success' | 'warning' | 'info' | 'destructive' | 'default';
  icon: typeof CheckCircle;
}> = {
  pending_receipt: { label: 'Pending Receipt', variant: 'warning', icon: Clock },
  received: { label: 'Received', variant: 'success', icon: CheckCircle },
  disputed: { label: 'Disputed', variant: 'destructive', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', variant: 'default', icon: XCircle },
  return_requested: { label: 'Return Requested', variant: 'info', icon: RotateCcw },
  return_approved: { label: 'Return Approved', variant: 'info', icon: RotateCcw },
  requested: { label: 'Requested', variant: 'default', icon: Clock },
  approved: { label: 'Approved', variant: 'info', icon: CheckCircle },
  in_transit: { label: 'In Transit', variant: 'warning', icon: Truck },
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-ZW', { month: 'short', day: 'numeric' });
}

function exportTransfersCSV(transfers: TransferListItem[]) {
  const header = 'Date,Type,Device,IMEI,Status,From,To\n';
  const rows = transfers
    .map(
      (t) =>
        `${new Date(t.created_at).toLocaleDateString('en-ZW')},${t.transfer_type},${t.device_manufacturer} ${t.device_model},${t.device_imei},${STATUS_CONFIG[t.status]?.label ?? t.status},${t.from_distributor_name ?? t.from_location ?? '-'},${t.to_distributor_name ?? t.to_location ?? '-'}`,
    )
    .join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transfers_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TransfersPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [returnDeviceId, setReturnDeviceId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reset page when search or tab changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeTab]);

  const { data: transferData, isLoading } = useQuery({
    queryKey: ['distributor', 'transfers', { search: debouncedSearch, page, limit: PAGE_LIMIT }],
    queryFn: () => fetchTransfers({
      search: debouncedSearch || undefined,
      page,
      limit: PAGE_LIMIT,
    }),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['distributor', 'inventory'],
    queryFn: fetchInventory,
    enabled: activeTab === 'returns',
  });

  const transfers = transferData?.data ?? [];
  const totalTransfers = transferData?.total ?? 0;
  const pendingCount = transferData?.pending_count ?? 0;

  const confirmMutation = useMutation({
    mutationFn: ({ id, spotChecks }: { id: string; spotChecks?: SpotCheckInput[] }) =>
      confirmTransfer(id, spotChecks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributor', 'transfers'] });
      queryClient.invalidateQueries({ queryKey: ['distributor', 'inventory'] });
      setConfirmingId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectTransfer(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributor', 'transfers'] });
      setRejectingId(null);
      setRejectReason('');
    },
  });

  const returnMutation = useMutation({
    mutationFn: ({ deviceId, reason }: { deviceId: string; reason: string }) =>
      requestReturn(deviceId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributor', 'transfers'] });
      queryClient.invalidateQueries({ queryKey: ['distributor', 'inventory'] });
      setReturnDeviceId(null);
      setReturnReason('');
    },
  });

  const filteredTransfers = useMemo(() => {
    switch (activeTab) {
      case 'pending':
        return transfers.filter(t =>
          ['pending_receipt', 'disputed'].includes(t.status)
        );
      case 'returns':
        return transfers.filter(t =>
          t.transfer_type === 'return' || ['return_requested', 'return_approved'].includes(t.status)
        );
      case 'history':
        return transfers.filter(t =>
          ['received', 'cancelled'].includes(t.status) && t.transfer_type !== 'return'
        );
      default:
        return transfers;
    }
  }, [transfers, activeTab]);

  const returnableDevices = useMemo(() => {
    return inventory.filter(d => d.status === 'available');
  }, [inventory]);

  if (isLoading && page === 1 && !debouncedSearch) {
    return <TransfersSkeleton />;
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'pending', label: 'Pending', count: pendingCount },
    { id: 'returns', label: 'Returns' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Transfers</h1>
          <p className="text-sm text-muted-foreground">
            Manage incoming shipments and device returns
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportTransfersCSV(filteredTransfers)}
          className="hidden sm:inline-flex"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by device, IMEI, or distributor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search transfers"
          className="w-full rounded-lg border bg-background pl-9 pr-4 py-2.5 text-base h-11 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3.5 w-3.5 text-yellow-500" />
            <span className="text-xs font-medium text-muted-foreground">Pending</span>
          </div>
          <p className="text-xl font-bold">{pendingCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs font-medium text-muted-foreground">Disputed</span>
          </div>
          <p className="text-xl font-bold">
            {transfers.filter(t => t.status === 'disputed').length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs font-medium text-muted-foreground">Received</span>
          </div>
          <p className="text-xl font-bold">
            {transfers.filter(t => t.status === 'received').length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportTransfersCSV(filteredTransfers)}
          className="sm:hidden mb-1"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Return button on returns tab */}
      {activeTab === 'returns' && (
        <div>
          <button
            onClick={() => setReturnDeviceId('selecting')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Request Return
          </button>
        </div>
      )}

      {/* Transfer list */}
      {filteredTransfers.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 shadow-sm text-center">
          <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {debouncedSearch
              ? 'No transfers match your search'
              : activeTab === 'pending'
                ? 'No pending transfers'
                : activeTab === 'returns'
                  ? 'No return requests'
                  : 'No transfer history'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransfers.map((transfer) => {
            const config = STATUS_CONFIG[transfer.status] ?? STATUS_CONFIG.requested;
            const Icon = config.icon;
            const isExpanded = expandedId === transfer.id;

            return (
              <div
                key={transfer.id}
                className="rounded-xl border bg-card shadow-sm overflow-hidden"
              >
                <button
                  className="w-full p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : transfer.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <ArrowLeftRight className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {transfer.device_manufacturer} {transfer.device_model}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          IMEI: {transfer.device_imei}
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

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {transfer.transfer_type === 'return' ? 'Return' : 'Incoming'} from{' '}
                      {transfer.from_distributor_name ?? transfer.from_location ?? 'Warehouse'}
                    </span>
                    <span>{formatTimeAgo(transfer.created_at)}</span>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t">
                    <div className="grid grid-cols-2 gap-3 text-sm pt-3">
                      <div>
                        <p className="text-muted-foreground">Type</p>
                        <p className="font-medium capitalize">{transfer.transfer_type}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Initiated By</p>
                        <p className="font-medium capitalize">{transfer.initiated_by_type}</p>
                      </div>
                      {transfer.from_location && (
                        <div>
                          <p className="text-muted-foreground">From</p>
                          <p className="font-medium">{transfer.from_distributor_name ?? transfer.from_location}</p>
                        </div>
                      )}
                      {transfer.to_location && (
                        <div>
                          <p className="text-muted-foreground">To</p>
                          <p className="font-medium">{transfer.to_distributor_name ?? transfer.to_location}</p>
                        </div>
                      )}
                      {transfer.rejection_reason && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Dispute Reason</p>
                          <p className="font-medium text-destructive">{transfer.rejection_reason}</p>
                        </div>
                      )}
                      {transfer.force_confirmed && (
                        <div className="col-span-2">
                          <Badge variant="warning" className="text-xs">Force Confirmed by Admin</Badge>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium">
                          {new Date(transfer.created_at).toLocaleDateString('en-ZW', {
                            weekday: 'short',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {transfer.status === 'pending_receipt' && (
                      <div className="flex gap-2 mt-4 pt-3 border-t">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmingId(transfer.id);
                          }}
                          className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                        >
                          Confirm Receipt
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRejectingId(transfer.id);
                          }}
                          className="flex-1 rounded-lg border border-destructive px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalTransfers > PAGE_LIMIT && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Pagination
            page={page}
            limit={PAGE_LIMIT}
            total={totalTransfers}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Confirm Modal */}
      {confirmingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card border shadow-lg p-6 space-y-4">
            <h2 className="text-lg font-bold">Confirm Transfer Receipt</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to confirm receipt of this transfer?
              The device will be added to your inventory.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmingId(null)}
                className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmMutation.mutate({ id: confirmingId })}
                disabled={confirmMutation.isPending}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {confirmMutation.isPending ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card border shadow-lg p-6 space-y-4">
            <h2 className="text-lg font-bold">Reject Transfer</h2>
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting this transfer. An admin will review your dispute.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Describe why you are rejecting this transfer (min 10 characters)..."
              rows={3}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            {rejectReason.length > 0 && rejectReason.length < 10 && (
              <p className="text-xs text-destructive">
                Reason must be at least 10 characters ({10 - rejectReason.length} more)
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason('');
                }}
                className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectingId, reason: rejectReason })}
                disabled={rejectReason.length < 10 || rejectMutation.isPending}
                className="flex-1 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnDeviceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card border shadow-lg p-6 space-y-4">
            <h2 className="text-lg font-bold">Request Device Return</h2>
            <p className="text-sm text-muted-foreground">
              Select a device from your inventory to return to the warehouse.
            </p>

            {returnableDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No available devices to return.
              </p>
            ) : (
              <>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {returnableDevices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => setReturnDeviceId(device.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-colors',
                        returnDeviceId === device.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted',
                      )}
                    >
                      <div>
                        <p className="font-medium">{device.brand} {device.model}</p>
                        <p className="text-xs text-muted-foreground font-mono">IMEI: {device.imei}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Reason for return (min 10 characters)..."
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                {returnReason.length > 0 && returnReason.length < 10 && (
                  <p className="text-xs text-destructive">
                    Reason must be at least 10 characters ({10 - returnReason.length} more)
                  </p>
                )}
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setReturnDeviceId(null);
                  setReturnReason('');
                }}
                className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (returnDeviceId && returnDeviceId !== 'selecting') {
                    returnMutation.mutate({ deviceId: returnDeviceId, reason: returnReason });
                  }
                }}
                disabled={
                  !returnDeviceId ||
                  returnDeviceId === 'selecting' ||
                  returnReason.length < 10 ||
                  returnMutation.isPending
                }
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {returnMutation.isPending ? 'Submitting...' : 'Submit Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
