'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  getTransfers,
  createTransfer,
  updateTransferStatus,
  type CreateTransferRequest,
  type StockTransfer,
} from '@/lib/api/devices';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { formatDateTime } from '@lynia/utils';
import { useToast } from '@/hooks/use-toast';
import { DeviceSearch } from '@/components/devices/DeviceSearch';
import { DistributorSearch } from '@/components/distributors/DistributorSearch';
import { ArrowLeft, Plus, Check, X, Truck, PackageCheck, Search } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE_MAP: Record<string, string> = {
  requested: 'pending',
  approved: 'active',
  in_transit: 'in_transit',
  received: 'completed',
  cancelled: 'failed',
};

/** Valid state transitions -- mirrors backend validTransitions map */
const validTransitions: Record<string, string[]> = {
  requested: ['approved', 'cancelled'],
  approved: ['in_transit', 'cancelled'],
  in_transit: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

interface TransferAction {
  label: string;
  value: string;
  variant?: 'danger' | 'outline' | 'primary';
  icon: React.ReactNode;
  description: string;
}

export default function TransfersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [actionModal, setActionModal] = useState<StockTransfer | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    transfer: StockTransfer;
    action: TransferAction;
  } | null>(null);

  const [form, setForm] = useState<CreateTransferRequest>({
    device_id: '',
    from_distributor_id: '',
    to_distributor_id: '',
    from_location: '',
    to_location: '',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', page, statusFilter, search],
    queryFn: () => getTransfers({
      status: statusFilter || undefined,
      search: search || undefined,
      page,
    }),
  });

  const createMutation = useMutation({
    mutationFn: () => createTransfer({
      ...form,
      from_distributor_id: form.from_distributor_id || undefined,
      to_distributor_id: form.to_distributor_id || undefined,
      from_location: form.from_location || undefined,
      to_location: form.to_location || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      setCreateModal(false);
      setForm({ device_id: '', from_distributor_id: '', to_distributor_id: '', from_location: '', to_location: '', notes: '' });
      toast({ title: 'Transfer request created', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create transfer', description: error.message, variant: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      updateTransferStatus(id, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      setActionModal(null);
      setCancelReason('');
      setConfirmAction(null);
      toast({ title: 'Transfer updated', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update transfer', description: error.message, variant: 'error' });
    },
  });

  const getNextActions = (status: string): TransferAction[] => {
    const allowed = validTransitions[status] || [];
    const actions: TransferAction[] = [];

    if (allowed.includes('approved')) {
      actions.push({
        label: 'Approve',
        value: 'approved',
        variant: 'primary',
        icon: <Check className="mr-1.5 h-4 w-4" />,
        description: 'Approve this transfer request. The device will be cleared for transit.',
      });
    }
    if (allowed.includes('in_transit')) {
      actions.push({
        label: 'Mark In Transit',
        value: 'in_transit',
        variant: 'primary',
        icon: <Truck className="mr-1.5 h-4 w-4" />,
        description: 'Mark this transfer as in transit. The device is on its way to the destination.',
      });
    }
    if (allowed.includes('received')) {
      actions.push({
        label: 'Mark Received',
        value: 'received',
        variant: 'primary',
        icon: <PackageCheck className="mr-1.5 h-4 w-4" />,
        description: 'Confirm the device has been received at the destination. This completes the transfer.',
      });
    }
    if (allowed.includes('cancelled')) {
      actions.push({
        label: 'Cancel',
        value: 'cancelled',
        variant: 'danger',
        icon: <X className="mr-1.5 h-4 w-4" />,
        description: 'Cancel this transfer. The device will remain at its current location.',
      });
    }
    return actions;
  };

  const columns: Column<StockTransfer>[] = [
    {
      key: 'device_imei',
      header: 'Device',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.manufacturer} {row.device_model}</p>
          <p className="font-mono text-xs text-gray-500">{row.device_imei}</p>
        </div>
      ),
    },
    {
      key: 'from_distributor_name',
      header: 'From',
      render: (row) => (
        <div className="text-sm">
          <p className="font-medium">{row.from_distributor_name || '-'}</p>
          {row.from_location && <p className="text-xs text-gray-500">{row.from_location}</p>}
        </div>
      ),
    },
    {
      key: 'to_distributor_name',
      header: 'To',
      render: (row) => (
        <div className="text-sm">
          <p className="font-medium">{row.to_distributor_name || '-'}</p>
          {row.to_location && <p className="text-xs text-gray-500">{row.to_location}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant="status" status={STATUS_BADGE_MAP[row.status] || row.status}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'requested_by_name',
      header: 'Requested By',
      render: (row) => <span className="text-sm text-gray-600">{row.requested_by_name || '-'}</span>,
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => <span className="text-sm text-gray-500">{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'id',
      header: '',
      render: (row) => {
        const actions = getNextActions(row.status);
        return actions.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setActionModal(row)}>
            Update
          </Button>
        ) : (
          <span className="text-xs text-gray-400 italic">No actions</span>
        );
      },
    },
  ];

  const inputClass =
    'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/devices" className="rounded-md p-1 hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Transfers</h1>
            <p className="text-sm text-gray-500">Transfer devices between distributors and locations</p>
          </div>
        </div>
        <Button onClick={() => setCreateModal(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Transfer
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
          className="relative flex-1 max-w-sm"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by IMEI, device, or distributor..."
            className="block w-full rounded-lg border border-gray-300 py-2 pl-10 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {searchInput && (
            <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyMessage="No transfers found"
      />

      {data && data.total_pages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.total_pages}
          total={data.total}
          pageSize={data.limit}
          onPageChange={setPage}
        />
      )}

      {/* Create Transfer Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="New Stock Transfer">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Device *</label>
            <div className="mt-1">
              <DeviceSearch
                value={form.device_id}
                onSelect={(d) => setForm((f) => ({ ...f, device_id: d.id }))}
                placeholder="Search by IMEI to find device..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">From Distributor</label>
              <div className="mt-1">
                <DistributorSearch
                  value={form.from_distributor_id || undefined}
                  onSelect={(d) => setForm((f) => ({ ...f, from_distributor_id: d.id }))}
                  placeholder="Search distributor..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">To Distributor</label>
              <div className="mt-1">
                <DistributorSearch
                  value={form.to_distributor_id || undefined}
                  onSelect={(d) => setForm((f) => ({ ...f, to_distributor_id: d.id }))}
                  placeholder="Search distributor..."
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">From Location</label>
              <input
                type="text"
                value={form.from_location || ''}
                onChange={(e) => setForm((f) => ({ ...f, from_location: e.target.value }))}
                placeholder="e.g., Warehouse A"
                className={inputClass + ' mt-1'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">To Location</label>
              <input
                type="text"
                value={form.to_location || ''}
                onChange={(e) => setForm((f) => ({ ...f, to_location: e.target.value }))}
                placeholder="e.g., Harare Branch"
                className={inputClass + ' mt-1'}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Additional notes..."
              className={inputClass + ' mt-1'}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Submitting...' : 'Request Transfer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Update Transfer Modal */}
      <Modal
        open={!!actionModal}
        onClose={() => { setActionModal(null); setCancelReason(''); }}
        title="Update Transfer"
      >
        {actionModal && (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Device</dt>
                <dd className="font-medium">{actionModal.manufacturer} {actionModal.device_model}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">IMEI</dt>
                <dd className="font-mono">{actionModal.device_imei}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">From</dt>
                <dd>{actionModal.from_distributor_name || actionModal.from_location || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">To</dt>
                <dd>{actionModal.to_distributor_name || actionModal.to_location || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Current Status</dt>
                <dd>
                  <Badge variant="status" status={STATUS_BADGE_MAP[actionModal.status] || actionModal.status}>
                    {actionModal.status.replace(/_/g, ' ')}
                  </Badge>
                </dd>
              </div>
            </dl>

            {/* Show cancel reason field only if cancel is a valid transition */}
            {(validTransitions[actionModal.status] || []).includes('cancelled') && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Cancellation Reason (if cancelling)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  className={inputClass + ' mt-1'}
                  placeholder="Required if cancelling..."
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              {getNextActions(actionModal.status).map((action) => {
                const isDisabled =
                  updateMutation.isPending ||
                  (action.value === 'cancelled' && !cancelReason.trim());

                return (
                  <Button
                    key={action.value}
                    variant={action.variant || 'primary'}
                    onClick={() => setConfirmAction({ transfer: actionModal, action })}
                    disabled={isDisabled}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* Transfer Action Confirmation Dialog */}
      <ConfirmationDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) {
            updateMutation.mutate({
              id: confirmAction.transfer.id,
              status: confirmAction.action.value,
              reason: confirmAction.action.value === 'cancelled' ? cancelReason : undefined,
            });
          }
        }}
        title={confirmAction?.action.label || ''}
        description={confirmAction?.action.description || ''}
        confirmLabel={confirmAction?.action.label || 'Confirm'}
        variant={confirmAction?.action.value === 'cancelled' ? 'destructive' : 'warning'}
        isLoading={updateMutation.isPending}
      />
    </div>
  );
}
