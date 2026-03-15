'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeviceById, getDeviceLockHistory, lockDevice, unlockDevice, updateDevice } from '@/lib/api/devices';
import { useAuth } from '@/lib/hooks/use-auth';
import { hasPermission } from '@/lib/permissions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { DataTable, type Column } from '@/components/ui/data-table';
import { formatCurrency, formatDate, formatDateTime } from '@lynia/utils';
import { useToast } from '@/hooks/use-toast';
import type { DeviceLock } from '@/types';
import { ArrowLeft, Smartphone, Lock, Unlock, AlertTriangle, Pencil } from 'lucide-react';
import Link from 'next/link';

const DESTRUCTIVE_STATUSES = ['damaged', 'lost', 'written_off'] as const;

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { toast } = useToast();
  const [lockModal, setLockModal] = useState(false);
  const [unlockModal, setUnlockModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [reason, setReason] = useState('');
  const [destructiveConfirm, setDestructiveConfirm] = useState(false);
  const [pendingEditPayload, setPendingEditPayload] = useState<Record<string, unknown> | null>(null);

  const { data: device, isLoading } = useQuery({
    queryKey: ['device', id],
    queryFn: () => getDeviceById(id),
    enabled: !!id,
  });

  const { data: lockHistory } = useQuery({
    queryKey: ['device-lock-history', id],
    queryFn: () => getDeviceLockHistory(id),
    enabled: !!id,
  });

  const lockMutation = useMutation({
    mutationFn: () => lockDevice(id, user!.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', id] });
      queryClient.invalidateQueries({ queryKey: ['device-lock-history', id] });
      setLockModal(false);
      setReason('');
      toast({ title: 'Device locked successfully', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to lock device', description: error.message, variant: 'error' });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockDevice(id, user!.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', id] });
      queryClient.invalidateQueries({ queryKey: ['device-lock-history', id] });
      setUnlockModal(false);
      setReason('');
      toast({ title: 'Device unlocked successfully', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to unlock device', description: error.message, variant: 'error' });
    },
  });

  const canLock = user && hasPermission(user.role, 'devices:lock');
  const canEdit = user && hasPermission(user.role, 'devices:write');

  const [editForm, setEditForm] = useState({
    status: '',
    condition: '',
    purchase_price_usd: '',
    retail_price_usd: '',
    location: '',
    color: '',
    storage_gb: '',
  });

  const editMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateDevice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', id] });
      setEditModal(false);
      toast({ title: 'Device updated successfully', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update device', description: error.message, variant: 'error' });
    },
  });

  function openEditModal() {
    if (device) {
      setEditForm({
        status: device.status || '',
        condition: device.condition || '',
        purchase_price_usd: device.purchase_price_usd != null ? String(device.purchase_price_usd) : '',
        retail_price_usd: device.retail_price_usd != null ? String(device.retail_price_usd) : '',
        location: device.location || '',
        color: device.color || '',
        storage_gb: device.storage_gb != null ? String(device.storage_gb) : '',
      });
      setEditModal(true);
    }
  }

  function buildEditPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (editForm.status) payload.status = editForm.status;
    if (editForm.condition) payload.condition = editForm.condition;
    if (editForm.purchase_price_usd) payload.purchase_price_usd = parseFloat(editForm.purchase_price_usd);
    if (editForm.retail_price_usd) payload.retail_price_usd = parseFloat(editForm.retail_price_usd);
    if (editForm.location) payload.location = editForm.location;
    if (editForm.color) payload.color = editForm.color;
    if (editForm.storage_gb) payload.storage_gb = parseInt(editForm.storage_gb);
    return payload;
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildEditPayload();
    const isDestructive = DESTRUCTIVE_STATUSES.includes(editForm.status as typeof DESTRUCTIVE_STATUSES[number])
      && editForm.status !== device?.status;

    if (isDestructive) {
      setPendingEditPayload(payload);
      setDestructiveConfirm(true);
    } else {
      editMutation.mutate(payload);
    }
  }

  function handleDestructiveConfirm() {
    if (pendingEditPayload) {
      editMutation.mutate(pendingEditPayload);
    }
    setDestructiveConfirm(false);
    setPendingEditPayload(null);
  }

  const lockHistoryColumns: Column<DeviceLock>[] = [
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => (
        <span className="text-sm text-muted-foreground">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Badge variant="status" status={row.action === 'lock' ? 'locked' : 'active'}>
          {row.action}
        </Badge>
      ),
    },
    {
      key: 'lock_type',
      header: 'Type',
      render: (row) => (
        <span className="capitalize text-sm">{row.lock_type.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.reason || '-'}</span>
      ),
    },
    {
      key: 'execution_status',
      header: 'Status',
      render: (row) => (
        <Badge variant="status" status={row.execution_status === 'success' ? 'completed' : row.execution_status}>
          {row.execution_status}
        </Badge>
      ),
    },
    {
      key: 'executed_by',
      header: 'Executed By',
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.executed_by ? `${row.executed_by.slice(0, 8)}...` : '-'}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-muted-foreground">Device not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/devices')}>
          Back to Devices
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/devices')} className="rounded-md p-1 hover:bg-accent">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Device Details</h1>
            <Badge variant="status" status={device.status}>
              {device.status.replace(/_/g, ' ')}
            </Badge>
            <Badge variant="status" status={device.lock_status}>
              {device.lock_status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{device.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" onClick={openEditModal}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          )}
          {canLock && (
            <>
              {device.lock_status === 'unlocked' ? (
                <Button variant="danger" onClick={() => setLockModal(true)}>
                  <Lock className="mr-1.5 h-4 w-4" />
                  Lock Device
                </Button>
              ) : device.lock_status === 'locked' ? (
                <Button variant="primary" onClick={() => setUnlockModal(true)}>
                  <Unlock className="mr-1.5 h-4 w-4" />
                  Unlock Device
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-2">
              <Smartphone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Value</p>
              <p className="text-lg font-semibold">{formatCurrency(device.retail_price_usd)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 dark:bg-green-950 p-2">
              <Smartphone className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Brand & Model</p>
              <p className="text-lg font-semibold">{device.manufacturer} {device.model}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-50 p-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">IMEI</p>
              <p className="text-lg font-semibold font-mono">{device.imei}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2">
              <Smartphone className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Condition</p>
              <p className="text-lg font-semibold capitalize">{device.condition.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Details Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Device Information */}
        <Card>
          <CardHeader>
            <CardTitle>Device Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {[
                ['Serial Number', device.serial_number || 'N/A'],
                ['Type', device.device_type],
                ['Storage', device.storage_gb ? `${device.storage_gb} GB` : 'N/A'],
                ['Color', device.color || 'N/A'],
                ['Location', device.location || 'N/A'],
                ['Trustonic ID', device.trustonic_device_id || 'N/A'],
                ['Trustonic Enrolled', device.trustonic_enrolled ? 'Yes' : 'No'],
                ['Created', formatDateTime(device.created_at)],
                ['Updated', formatDateTime(device.updated_at)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Assignment */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            {device.customer || device.loan ? (
              <dl className="space-y-3">
                {device.customer && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-sm text-muted-foreground">Customer</dt>
                      <dd className="text-sm font-medium">
                        <Link
                          href={`/customers/${device.customer.id}`}
                          className="text-brand-600 hover:text-brand-700"
                        >
                          {device.customer.full_name}
                        </Link>
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-muted-foreground">Phone</dt>
                      <dd className="text-sm font-medium text-foreground">{device.customer.phone_number}</dd>
                    </div>
                  </>
                )}
                {device.loan && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Loan</dt>
                    <dd className="text-sm font-medium">
                      <Link
                        href={`/loans/${device.loan.id}`}
                        className="font-mono text-brand-600 hover:text-brand-700"
                      >
                        {device.loan.id.slice(0, 8)}...
                      </Link>
                      <span className="ml-2 text-muted-foreground">
                        ({formatCurrency(device.loan.loan_amount_usd)})
                      </span>
                    </dd>
                  </div>
                )}
                {device.assigned_at && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Assigned Date</dt>
                    <dd className="text-sm font-medium text-foreground">{formatDateTime(device.assigned_at)}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Smartphone className="h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm text-muted-foreground">Not assigned</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lock History */}
      <Card>
        <CardHeader>
          <CardTitle>Lock History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={lockHistoryColumns}
            data={lockHistory || []}
            keyExtractor={(row) => row.id}
            emptyMessage="No lock history recorded"
          />
        </CardContent>
      </Card>

      {/* Lock Modal */}
      <Modal open={lockModal} onClose={() => setLockModal(false)} title="Lock Device">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-red-50 dark:bg-red-950 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Warning</p>
              <p className="text-sm text-red-600">
                Locking this device will restrict the customer from using it. This action will
                take effect immediately.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Lock <strong>{device.manufacturer} {device.model}</strong> (IMEI: {device.imei})?
          </p>
          <div>
            <label className="block text-sm font-medium text-foreground">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Provide reason for locking this device..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setLockModal(false); setReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => lockMutation.mutate()}
              disabled={!reason.trim() || lockMutation.isPending}
            >
              {lockMutation.isPending ? 'Locking...' : 'Confirm Lock'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unlock Modal */}
      <Modal open={unlockModal} onClose={() => setUnlockModal(false)} title="Unlock Device">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Unlock <strong>{device.manufacturer} {device.model}</strong> (IMEI: {device.imei})?
            The customer will regain full access to the device.
          </p>
          <div>
            <label className="block text-sm font-medium text-foreground">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Provide reason for unlocking this device..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setUnlockModal(false); setReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => unlockMutation.mutate()}
              disabled={!reason.trim() || unlockMutation.isPending}
            >
              {unlockMutation.isPending ? 'Unlocking...' : 'Confirm Unlock'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Device Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Device" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="in_stock">In Stock</option>
                <option value="assigned">Assigned</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
                <option value="returned">Returned</option>
                <option value="repossessed">Repossessed</option>
                <option value="damaged">Damaged</option>
                <option value="lost">Lost</option>
                <option value="written_off">Written Off</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Condition</label>
              <select
                value={editForm.condition}
                onChange={(e) => setEditForm((f) => ({ ...f, condition: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="new">New</option>
                <option value="grade_a">Grade A</option>
                <option value="grade_b">Grade B</option>
                <option value="grade_c">Grade C</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Purchase Price (USD)</label>
              <input
                type="number"
                step="0.01"
                value={editForm.purchase_price_usd}
                onChange={(e) => setEditForm((f) => ({ ...f, purchase_price_usd: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Retail Price (USD)</label>
              <input
                type="number"
                step="0.01"
                value={editForm.retail_price_usd}
                onChange={(e) => setEditForm((f) => ({ ...f, retail_price_usd: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Location</label>
              <input
                type="text"
                value={editForm.location}
                onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Warehouse, Harare Office"
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Color</label>
              <input
                type="text"
                value={editForm.color}
                onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Storage (GB)</label>
            <input
              type="number"
              value={editForm.storage_gb}
              onChange={(e) => setEditForm((f) => ({ ...f, storage_gb: e.target.value }))}
              className="mt-1 block w-full max-w-[200px] rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" type="button" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button type="submit" disabled={editMutation.isPending}>
              {editMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Destructive Status Change Confirmation */}
      <ConfirmationDialog
        open={destructiveConfirm}
        onClose={() => { setDestructiveConfirm(false); setPendingEditPayload(null); }}
        onConfirm={handleDestructiveConfirm}
        title={`Mark Device as ${editForm.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`}
        description={
          `You are about to change this device's status to "${editForm.status.replace(/_/g, ' ')}". ` +
          'This is a destructive action that may affect inventory records and cannot be easily reversed. ' +
          'Are you sure you want to proceed?'
        }
        confirmLabel={`Mark as ${editForm.status.replace(/_/g, ' ')}`}
        variant="destructive"
        isLoading={editMutation.isPending}
      />
    </div>
  );
}
