'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeviceById, getDeviceLockHistory, lockDevice, unlockDevice } from '@/lib/api/devices';
import { useAuth } from '@/lib/hooks/use-auth';
import { hasPermission } from '@/lib/permissions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { DataTable, type Column } from '@/components/ui/data-table';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { DeviceLock } from '@/types';
import { ArrowLeft, Smartphone, Lock, Unlock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [lockModal, setLockModal] = useState(false);
  const [unlockModal, setUnlockModal] = useState(false);
  const [reason, setReason] = useState('');

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
    },
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockDevice(id, user!.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', id] });
      queryClient.invalidateQueries({ queryKey: ['device-lock-history', id] });
      setUnlockModal(false);
      setReason('');
    },
  });

  const canLock = user && hasPermission(user.role, 'devices:lock');

  const lockHistoryColumns: Column<DeviceLock>[] = [
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => (
        <span className="text-sm text-gray-500">{formatDateTime(row.created_at)}</span>
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
        <span className="text-sm text-gray-600">{row.reason || '-'}</span>
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
        <span className="font-mono text-xs text-gray-500">
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
        <p className="text-lg text-gray-500">Device not found</p>
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
        <button onClick={() => router.push('/devices')} className="rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Device Details</h1>
            <Badge variant="status" status={device.status}>
              {device.status.replace('_', ' ')}
            </Badge>
            <Badge variant="status" status={device.lock_status}>
              {device.lock_status}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 font-mono">{device.id}</p>
        </div>
        {canLock && (
          <div>
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
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <Smartphone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Value</p>
              <p className="text-lg font-semibold">{formatCurrency(device.device_value_usd)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <Smartphone className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Brand & Model</p>
              <p className="text-lg font-semibold">{device.device_brand} {device.device_model}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-50 p-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">IMEI</p>
              <p className="text-lg font-semibold font-mono">{device.device_imei}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2">
              <Smartphone className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Condition</p>
              <p className="text-lg font-semibold capitalize">{device.condition.replace('_', ' ')}</p>
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
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-900">{value}</dd>
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
                      <dt className="text-sm text-gray-500">Customer</dt>
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
                      <dt className="text-sm text-gray-500">Phone</dt>
                      <dd className="text-sm font-medium text-gray-900">{device.customer.phone_number}</dd>
                    </div>
                  </>
                )}
                {device.loan && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Loan</dt>
                    <dd className="text-sm font-medium">
                      <Link
                        href={`/loans/${device.loan.id}`}
                        className="font-mono text-brand-600 hover:text-brand-700"
                      >
                        {device.loan.id.slice(0, 8)}...
                      </Link>
                      <span className="ml-2 text-gray-500">
                        ({formatCurrency(device.loan.loan_amount_usd)})
                      </span>
                    </dd>
                  </div>
                )}
                {device.assigned_at && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Assigned Date</dt>
                    <dd className="text-sm font-medium text-gray-900">{formatDateTime(device.assigned_at)}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Smartphone className="h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">Not assigned</p>
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
          <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Warning</p>
              <p className="text-sm text-red-600">
                Locking this device will restrict the customer from using it. This action will
                take effect immediately.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Lock <strong>{device.device_brand} {device.device_model}</strong> (IMEI: {device.device_imei})?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
          <p className="text-sm text-gray-600">
            Unlock <strong>{device.device_brand} {device.device_model}</strong> (IMEI: {device.device_imei})?
            The customer will regain full access to the device.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
    </div>
  );
}
