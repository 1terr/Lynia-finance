'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  getTransfers,
  createTransfer,
  updateTransferStatus,
  forceConfirmTransfer,
  createReturn,
  approveReturn,
  type CreateTransferRequest,
  type CreateReturnRequest,
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
import { ArrowLeft, Plus, Check, X, Truck, PackageCheck, Search, Shield, RotateCcw, CheckCircle } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'pending_receipt', label: 'Pending Receipt' },
  { value: 'received', label: 'Received' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'return_requested', label: 'Return Requested' },
  { value: 'return_approved', label: 'Return Approved' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE_MAP: Record<string, string> = {
  requested: 'pending',
  approved: 'active',
  in_transit: 'in_transit',
  pending_receipt: 'pending_receipt',
  received: 'completed',
  disputed: 'disputed',
  return_requested: 'return_requested',
  return_approved: 'return_approved',
  cancelled: 'failed',
};

const TRANSFER_TYPE_BADGE_MAP: Record<string, string> = {
  outbound: 'in_transit',
  return: 'returned',
};

/** Valid state transitions -- mirrors backend validTransitions map */
const validTransitions: Record<string, string[]> = {
  requested: ['approved', 'cancelled'],
  approved: ['in_transit', 'cancelled'],
  in_transit: ['pending_receipt', 'cancelled'],
  pending_receipt: ['cancelled'],
  disputed: ['cancelled'],
  return_requested: ['return_approved', 'cancelled'],
  return_approved: [],
  received: [],
  cancelled: [],
};

/** Statuses that support the admin force-confirm override action */
const FORCE_CONFIRMABLE_STATUSES = ['pending_receipt', 'disputed'];

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
  const [returnModal, setReturnModal] = useState(false);
  const [actionModal, setActionModal] = useState<StockTransfer | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    transfer: StockTransfer;
    action: TransferAction;
  } | null>(null);

  // Force confirm state
  const [forceConfirmModal, setForceConfirmModal] = useState<StockTransfer | null>(null);
  const [forceConfirmReason, setForceConfirmReason] = useState('');

  // Approve return confirmation state
  const [approveReturnTransfer, setApproveReturnTransfer] = useState<StockTransfer | null>(null);

  const [form, setForm] = useState<CreateTransferRequest>({
    device_id: '',
    from_distributor_id: '',
    to_distributor_id: '',
    from_location: '',
    to_location: '',
    notes: '',
  });

  const [returnForm, setReturnForm] = useState<CreateReturnRequest>({
    device_id: '',
    from_distributor_id: '',
    reason: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', page, statusFilter, search],
    queryFn: () => getTransfers({
      status: statusFilter || undefined,
      search: search || undefined,
      page,
    }),
  });

  const invalidateTransferQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
    queryClient.invalidateQueries({ queryKey: ['devices'] });
    queryClient.invalidateQueries({ queryKey: ['device-stats'] });
  };

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
      invalidateTransferQueries();
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
      invalidateTransferQueries();
      setActionModal(null);
      setCancelReason('');
      setConfirmAction(null);
      toast({ title: 'Transfer updated', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update transfer', description: error.message, variant: 'error' });
    },
  });

  const forceConfirmMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      forceConfirmTransfer(id, reason),
    onSuccess: () => {
      invalidateTransferQueries();
      setForceConfirmModal(null);
      setForceConfirmReason('');
      setActionModal(null);
      toast({ title: 'Transfer force-confirmed', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to force-confirm transfer', description: error.message, variant: 'error' });
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: () => createReturn(returnForm),
    onSuccess: () => {
      invalidateTransferQueries();
      setReturnModal(false);
      setReturnForm({ device_id: '', from_distributor_id: '', reason: '' });
      toast({ title: 'Return request created', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create return', description: error.message, variant: 'error' });
    },
  });

  const approveReturnMutation = useMutation({
    mutationFn: (id: string) => approveReturn(id),
    onSuccess: () => {
      invalidateTransferQueries();
      setApproveReturnTransfer(null);
      toast({ title: 'Return approved', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to approve return', description: error.message, variant: 'error' });
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
    if (allowed.includes('pending_receipt')) {
      actions.push({
        label: 'Mark Pending Receipt',
        value: 'pending_receipt',
        variant: 'primary',
        icon: <PackageCheck className="mr-1.5 h-4 w-4" />,
        description: 'Mark this transfer as pending receipt. Awaiting distributor confirmation.',
      });
    }
    if (allowed.includes('return_approved')) {
      actions.push({
        label: 'Approve Return',
        value: 'return_approved',
        variant: 'primary',
        icon: <CheckCircle className="mr-1.5 h-4 w-4" />,
        description: 'Approve this return request. The device will be returned to inventory.',
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
          <p className="font-mono text-xs text-muted-foreground">{row.device_imei}</p>
        </div>
      ),
    },
    {
      key: 'transfer_type' as keyof StockTransfer,
      header: 'Type',
      render: (row) => {
        const type = row.transfer_type || 'outbound';
        return (
          <Badge variant="status" status={TRANSFER_TYPE_BADGE_MAP[type] || type}>
            {type}
          </Badge>
        );
      },
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
        <Badge variant="status" status={STATUS_BADGE_MAP[row.status] || row.status}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'batch_id' as keyof StockTransfer,
      header: 'Batch',
      render: (row) => row.batch_id ? (
        <span className="font-mono text-xs text-muted-foreground" title={row.batch_id}>
          {row.batch_id.slice(0, 8)}...
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
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
        const actions = getNextActions(row.status);
        const hasForceConfirm = FORCE_CONFIRMABLE_STATUSES.includes(row.status);
        const hasApproveReturn = row.status === 'return_requested';

        if (actions.length === 0 && !hasForceConfirm && !hasApproveReturn) {
          return <span className="text-xs text-muted-foreground italic">No actions</span>;
        }

        return (
          <div className="flex gap-1.5">
            {(actions.length > 0 || hasForceConfirm) && (
              <Button variant="outline" size="sm" onClick={() => setActionModal(row)}>
                Update
              </Button>
            )}
            {hasApproveReturn && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApproveReturnTransfer(row)}
                className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
              >
                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                Approve Return
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const inputClass =
    'block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/devices" className="rounded-md p-1 hover:bg-accent">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Stock Transfers</h1>
            <p className="text-sm text-muted-foreground">Transfer devices between distributors and locations</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReturnModal(true)}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Create Return
          </Button>
          <Button onClick={() => setCreateModal(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Transfer
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
          className="relative flex-1 max-w-sm"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by IMEI, device, or distributor..."
            className="block w-full rounded-lg border border-border py-2 pl-10 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {searchInput && (
            <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-border px-3 py-2 text-sm"
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
            <label htmlFor="transfer-device" className="block text-sm font-medium text-foreground">Device *</label>
            <div className="mt-1">
              <DeviceSearch
                id="transfer-device"
                value={form.device_id}
                onSelect={(d) => setForm((f) => ({ ...f, device_id: d.id }))}
                placeholder="Search by IMEI to find device..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="transfer-from-distributor" className="block text-sm font-medium text-foreground">From Distributor</label>
              <div className="mt-1">
                <DistributorSearch
                  id="transfer-from-distributor"
                  value={form.from_distributor_id || undefined}
                  onSelect={(d) => setForm((f) => ({ ...f, from_distributor_id: d.id }))}
                  placeholder="Search distributor..."
                />
              </div>
            </div>
            <div>
              <label htmlFor="transfer-to-distributor" className="block text-sm font-medium text-foreground">To Distributor</label>
              <div className="mt-1">
                <DistributorSearch
                  id="transfer-to-distributor"
                  value={form.to_distributor_id || undefined}
                  onSelect={(d) => setForm((f) => ({ ...f, to_distributor_id: d.id }))}
                  placeholder="Search distributor..."
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="transfer-from-location" className="block text-sm font-medium text-foreground">From Location</label>
              <input
                id="transfer-from-location"
                type="text"
                value={form.from_location || ''}
                onChange={(e) => setForm((f) => ({ ...f, from_location: e.target.value }))}
                placeholder="e.g., Warehouse A"
                className={inputClass + ' mt-1'}
              />
            </div>
            <div>
              <label htmlFor="transfer-to-location" className="block text-sm font-medium text-foreground">To Location</label>
              <input
                id="transfer-to-location"
                type="text"
                value={form.to_location || ''}
                onChange={(e) => setForm((f) => ({ ...f, to_location: e.target.value }))}
                placeholder="e.g., Harare Branch"
                className={inputClass + ' mt-1'}
              />
            </div>
          </div>
          <div>
            <label htmlFor="transfer-notes" className="block text-sm font-medium text-foreground">Notes</label>
            <textarea
              id="transfer-notes"
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

      {/* Create Return Modal */}
      <Modal open={returnModal} onClose={() => setReturnModal(false)} title="Create Return">
        <form onSubmit={(e) => { e.preventDefault(); createReturnMutation.mutate(); }} className="space-y-4">
          <div>
            <label htmlFor="return-device" className="block text-sm font-medium text-foreground">Device *</label>
            <div className="mt-1">
              <DeviceSearch
                id="return-device"
                value={returnForm.device_id}
                onSelect={(d) => setReturnForm((f) => ({ ...f, device_id: d.id }))}
                placeholder="Search by IMEI to find device..."
              />
            </div>
          </div>
          <div>
            <label htmlFor="return-from-distributor" className="block text-sm font-medium text-foreground">From Distributor *</label>
            <div className="mt-1">
              <DistributorSearch
                id="return-from-distributor"
                value={returnForm.from_distributor_id || undefined}
                onSelect={(d) => setReturnForm((f) => ({ ...f, from_distributor_id: d.id }))}
                placeholder="Select the distributor returning the device..."
              />
            </div>
          </div>
          <div>
            <label htmlFor="return-reason" className="block text-sm font-medium text-foreground">Reason *</label>
            <textarea
              id="return-reason"
              value={returnForm.reason}
              onChange={(e) => setReturnForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3}
              placeholder="Why is this device being returned?"
              className={inputClass + ' mt-1'}
            />
            <p className="mt-1 text-xs text-muted-foreground">Minimum 5 characters required</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setReturnModal(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={
                createReturnMutation.isPending ||
                !returnForm.device_id ||
                !returnForm.from_distributor_id ||
                returnForm.reason.trim().length < 5
              }
            >
              {createReturnMutation.isPending ? 'Submitting...' : 'Create Return'}
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
                <dt className="text-muted-foreground">Device</dt>
                <dd className="font-medium">{actionModal.manufacturer} {actionModal.device_model}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">IMEI</dt>
                <dd className="font-mono">{actionModal.device_imei}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">From</dt>
                <dd>{actionModal.from_distributor_name || actionModal.from_location || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">To</dt>
                <dd>{actionModal.to_distributor_name || actionModal.to_location || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Current Status</dt>
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
                <label htmlFor="transfer-cancel-reason" className="block text-sm font-medium text-foreground">Cancellation Reason (if cancelling)</label>
                <textarea
                  id="transfer-cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  className={inputClass + ' mt-1'}
                  placeholder="Required if cancelling..."
                />
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {/* Force Confirm button for pending_receipt and disputed statuses */}
              {FORCE_CONFIRMABLE_STATUSES.includes(actionModal.status) && (
                <Button
                  variant="outline"
                  onClick={() => setForceConfirmModal(actionModal)}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                >
                  <Shield className="mr-1.5 h-4 w-4" />
                  Force Confirm
                </Button>
              )}

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

      {/* Force Confirm Modal */}
      <Modal
        open={!!forceConfirmModal}
        onClose={() => { setForceConfirmModal(null); setForceConfirmReason(''); }}
        title="Force Confirm Transfer"
      >
        {forceConfirmModal && (
          <div className="space-y-4">
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400" />
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Admin Override Action</p>
                  <p className="mt-1 text-sm text-orange-700 dark:text-orange-400">
                    This will override the distributor&apos;s confirmation step. Use only when the distributor cannot confirm receipt through normal channels.
                  </p>
                </div>
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Device</dt>
                <dd className="font-medium">{forceConfirmModal.manufacturer} {forceConfirmModal.device_model}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">IMEI</dt>
                <dd className="font-mono">{forceConfirmModal.device_imei}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Current Status</dt>
                <dd>
                  <Badge variant="status" status={STATUS_BADGE_MAP[forceConfirmModal.status] || forceConfirmModal.status}>
                    {forceConfirmModal.status.replace(/_/g, ' ')}
                  </Badge>
                </dd>
              </div>
            </dl>

            <div>
              <label htmlFor="force-confirm-reason" className="block text-sm font-medium text-foreground">
                Reason for force confirmation *
              </label>
              <textarea
                id="force-confirm-reason"
                value={forceConfirmReason}
                onChange={(e) => setForceConfirmReason(e.target.value)}
                rows={3}
                className={inputClass + ' mt-1'}
                placeholder="Explain why this transfer is being force-confirmed..."
              />
              <p className="mt-1 text-xs text-muted-foreground">Minimum 5 characters required. This will be recorded in the audit log.</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setForceConfirmModal(null); setForceConfirmReason(''); }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  forceConfirmMutation.mutate({
                    id: forceConfirmModal.id,
                    reason: forceConfirmReason,
                  });
                }}
                disabled={forceConfirmMutation.isPending || forceConfirmReason.trim().length < 5}
                className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600"
              >
                <Shield className="mr-1.5 h-4 w-4" />
                {forceConfirmMutation.isPending ? 'Confirming...' : 'Force Confirm'}
              </Button>
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

      {/* Approve Return Confirmation Dialog */}
      <ConfirmationDialog
        open={!!approveReturnTransfer}
        onClose={() => setApproveReturnTransfer(null)}
        onConfirm={() => {
          if (approveReturnTransfer) {
            approveReturnMutation.mutate(approveReturnTransfer.id);
          }
        }}
        title="Approve Return"
        description={
          approveReturnTransfer
            ? `Approve the return of ${approveReturnTransfer.manufacturer || ''} ${approveReturnTransfer.device_model || ''} (${approveReturnTransfer.device_imei || 'N/A'}) from ${approveReturnTransfer.from_distributor_name || 'unknown distributor'}? The device will be returned to inventory.`
            : ''
        }
        confirmLabel="Approve Return"
        variant="warning"
        isLoading={approveReturnMutation.isPending}
      />
    </div>
  );
}
