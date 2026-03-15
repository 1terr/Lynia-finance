'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  getAdjustments,
  createAdjustment,
  approveAdjustment,
  type CreateAdjustmentRequest,
  type InventoryAdjustment,
} from '@/lib/api/devices';
import { useAuth } from '@/lib/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { formatDateTime } from '@lynia/utils';
import { useToast } from '@/hooks/use-toast';
import { DeviceSearch } from '@/components/devices/DeviceSearch';
import { ArrowLeft, Plus, CheckCircle, XCircle, Search, X } from 'lucide-react';

const ADJUSTMENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'damage', label: 'Damage' },
  { value: 'write_off', label: 'Write Off' },
  { value: 'found', label: 'Found' },
  { value: 'audit_correction', label: 'Audit Correction' },
  { value: 'add', label: 'Add' },
  { value: 'remove', label: 'Remove' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_TO_BADGE: Record<string, string> = {
  damage: 'damaged',
  write_off: 'written_off',
  found: 'in_stock',
  audit_correction: 'in_stock',
  remove: 'written_off',
};

export default function AdjustmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [approveModal, setApproveModal] = useState<InventoryAdjustment | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Create form state
  const [form, setForm] = useState<CreateAdjustmentRequest>({
    device_id: '',
    adjustment_type: 'damage',
    reason: '',
    new_status: 'damaged',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['adjustments', page, typeFilter, statusFilter, search],
    queryFn: () => getAdjustments({
      approval_status: statusFilter || undefined,
      adjustment_type: typeFilter || undefined,
      search: search || undefined,
      page,
    }),
  });

  const createMutation = useMutation({
    mutationFn: () => createAdjustment(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      setCreateModal(false);
      setForm({ device_id: '', adjustment_type: 'damage', reason: '', new_status: 'damaged', notes: '' });
      toast({ title: 'Adjustment created', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create adjustment', description: error.message, variant: 'error' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      approveAdjustment(id, action, action === 'reject' ? rejectReason : undefined),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      setApproveModal(null);
      setRejectReason('');
      toast({
        title: variables.action === 'approve' ? 'Adjustment approved' : 'Adjustment rejected',
        variant: 'success',
      });
    },
    onError: (error: Error, variables) => {
      toast({
        title: variables.action === 'approve' ? 'Failed to approve' : 'Failed to reject',
        description: error.message,
        variant: 'error',
      });
    },
  });

  const columns: Column<InventoryAdjustment>[] = [
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
      key: 'adjustment_type',
      header: 'Type',
      render: (row) => (
        <Badge variant="status" status={row.adjustment_type}>
          {row.adjustment_type.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => <span className="text-sm text-muted-foreground">{row.reason}</span>,
    },
    {
      key: 'approval_status',
      header: 'Status',
      render: (row) => (
        <Badge
          variant="status"
          status={row.approval_status === 'approved' ? 'completed' : row.approval_status === 'rejected' ? 'failed' : 'pending'}
        >
          {row.approval_status}
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
      render: (row) =>
        row.approval_status === 'pending' ? (
          <Button variant="outline" size="sm" onClick={() => setApproveModal(row)}>
            Review
          </Button>
        ) : null,
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
            <h1 className="text-2xl font-bold text-foreground">Inventory Adjustments</h1>
            <p className="text-sm text-muted-foreground">Record and approve stock changes</p>
          </div>
        </div>
        <Button onClick={() => setCreateModal(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Adjustment
        </Button>
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
            placeholder="Search by IMEI, device, or reason..."
            className="block w-full rounded-lg border border-border py-2 pl-10 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {searchInput && (
            <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          {ADJUSTMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
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
        emptyMessage="No adjustments found"
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

      {/* Create Adjustment Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="New Inventory Adjustment">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground">Device *</label>
            <div className="mt-1">
              <DeviceSearch
                value={form.device_id}
                onSelect={(d) => setForm((f) => ({ ...f, device_id: d.id }))}
                placeholder="Search by IMEI to find device..."
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Adjustment Type *</label>
            <select
              value={form.adjustment_type}
              onChange={(e) => {
                const type = e.target.value as CreateAdjustmentRequest['adjustment_type'];
                setForm((f) => ({ ...f, adjustment_type: type, new_status: STATUS_TO_BADGE[type] || '' }));
              }}
              className={inputClass + ' mt-1'}
            >
              <option value="damage">Damage</option>
              <option value="write_off">Write Off</option>
              <option value="found">Found</option>
              <option value="audit_correction">Audit Correction</option>
              <option value="add">Add</option>
              <option value="remove">Remove</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">New Device Status</label>
            <select
              value={form.new_status || ''}
              onChange={(e) => setForm((f) => ({ ...f, new_status: e.target.value || undefined }))}
              className={inputClass + ' mt-1'}
            >
              <option value="">No change</option>
              <option value="in_stock">In Stock</option>
              <option value="damaged">Damaged</option>
              <option value="lost">Lost</option>
              <option value="written_off">Written Off</option>
              <option value="returned">Returned</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Reason *</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3}
              required
              placeholder="Describe why this adjustment is needed..."
              className={inputClass + ' mt-1'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Notes</label>
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
              {createMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Approve/Reject Modal */}
      <Modal
        open={!!approveModal}
        onClose={() => { setApproveModal(null); setRejectReason(''); }}
        title="Review Adjustment"
      >
        {approveModal && (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Device</dt>
                <dd className="font-medium">{approveModal.manufacturer} {approveModal.device_model}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">IMEI</dt>
                <dd className="font-mono">{approveModal.device_imei}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="capitalize">{approveModal.adjustment_type.replace(/_/g, ' ')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status Change</dt>
                <dd>{approveModal.previous_status} &rarr; {approveModal.new_status || 'No change'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reason</dt>
                <dd className="mt-1">{approveModal.reason}</dd>
              </div>
            </dl>

            <div>
              <label className="block text-sm font-medium text-foreground">Rejection Reason (if rejecting)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                className={inputClass + ' mt-1'}
                placeholder="Required if rejecting..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="danger"
                onClick={() => approveMutation.mutate({ id: approveModal.id, action: 'reject' })}
                disabled={approveMutation.isPending || !rejectReason.trim()}
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={() => approveMutation.mutate({ id: approveModal.id, action: 'approve' })}
                disabled={approveMutation.isPending}
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
