'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { getDevices, lockDevice, unlockDevice, getDeviceStats, type DeviceWithCustomer, type DeviceStats } from '@/lib/api/devices';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/lib/auth/context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { truncateId } from '@/lib/utils';
import {
  Lock,
  Unlock,
  Search,
  Filter,
  Shield,
  ShieldOff,
  Smartphone,
} from 'lucide-react';

export default function LockUnlockPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [lockStatusFilter, setLockStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [lockModal, setLockModal] = useState<DeviceWithCustomer | null>(null);
  const [unlockModal, setUnlockModal] = useState<DeviceWithCustomer | null>(null);
  const [reason, setReason] = useState('');

  const { data: stats } = useQuery<DeviceStats>({
    queryKey: ['device-stats'],
    queryFn: getDeviceStats,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['devices-lock', page, lockStatusFilter, search],
    queryFn: () => getDevices({
      lock_status: (lockStatusFilter as 'locked' | 'unlocked' | 'pending') || undefined,
      search: search || undefined,
      page,
      limit: 25,
    }),
  });

  const lockMutation = useMutation({
    mutationFn: () => {
      if (!lockModal || !user) throw new Error('Missing context');
      return lockDevice(lockModal.id, user.id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices-lock'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      setLockModal(null);
      setReason('');
    },
  });

  const unlockMutation = useMutation({
    mutationFn: () => {
      if (!unlockModal || !user) throw new Error('Missing context');
      return unlockDevice(unlockModal.id, user.id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices-lock'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      setUnlockModal(null);
      setReason('');
    },
  });

  const devices = data?.data || [];

  return (
    <ProtectedRoute requiredPermission={{ resource: 'devices', action: 'update' }}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/devices" className="text-sm text-gray-500 hover:text-gray-700">
              Devices
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-700">Lock/Unlock</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Device Lock/Unlock</h1>
          <p className="mt-1 text-sm text-gray-500">
            Remotely control device lock status
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-50 p-2">
                  <Lock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Locked Devices</p>
                  <p className="text-lg font-semibold text-red-600">{stats.locked}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2">
                  <Unlock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active Devices</p>
                  <p className="text-lg font-semibold text-green-600">{stats.active}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Allocated</p>
                  <p className="text-lg font-semibold">{stats.allocated + stats.active}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by IMEI, brand, or model..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={lockStatusFilter}
              onChange={(e) => { setLockStatusFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Lock States</option>
              <option value="locked">Locked</option>
              <option value="unlocked">Unlocked</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Device Table */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <Smartphone className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-lg font-medium text-gray-500">No devices found</p>
            <p className="mt-1 text-sm text-gray-400">
              {search || lockStatusFilter ? 'Try adjusting your filters.' : 'No devices in the system.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Device</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">IMEI</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Lock Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {devices.map((device: DeviceWithCustomer) => {
                  const customer = Array.isArray(device.customer) ? device.customer[0] : device.customer;
                  const isLocked = (device as Record<string, unknown>).lock_status === 'locked';
                  return (
                    <tr key={device.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link href={`/devices/${device.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                          {(device as Record<string, string>).device_brand || (device as Record<string, string>).brand}{' '}
                          {(device as Record<string, string>).device_model || (device as Record<string, string>).model}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 font-mono">
                        {(device as Record<string, string>).device_imei || (device as Record<string, string>).imei || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {customer ? (
                          <div>
                            <p className="text-sm text-gray-900">{(customer as Record<string, string>).full_name}</p>
                            <p className="text-xs text-gray-500">{(customer as Record<string, string>).phone_number}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Badge variant={(device as Record<string, string>).status === 'active' ? 'green' : 'gray'}>
                          {(device as Record<string, string>).status}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {isLocked ? (
                          <span className="flex items-center gap-1 text-sm font-medium text-red-600">
                            <Shield className="h-4 w-4" />
                            Locked
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                            <ShieldOff className="h-4 w-4" />
                            Unlocked
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {isLocked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUnlockModal(device)}
                          >
                            <Unlock className="mr-1.5 h-3.5 w-3.5" />
                            Unlock
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setLockModal(device)}
                          >
                            <Lock className="mr-1.5 h-3.5 w-3.5" />
                            Lock
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total_pages > 1 && (
          <Pagination
            page={data.page}
            totalPages={data.total_pages}
            total={data.total}
            pageSize={data.limit}
            onPageChange={setPage}
          />
        )}

        {/* Lock Modal */}
        <Modal
          open={!!lockModal}
          onClose={() => { setLockModal(null); setReason(''); }}
          title="Lock Device"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Lock device <strong>{lockModal ? `${(lockModal as Record<string, string>).device_brand || (lockModal as Record<string, string>).brand} ${(lockModal as Record<string, string>).device_model || (lockModal as Record<string, string>).model}` : ''}</strong>?
              The device will be remotely locked and unusable until unlocked.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reason *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="e.g., Missed payments, account delinquent..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setLockModal(null); setReason(''); }}>
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
        <Modal
          open={!!unlockModal}
          onClose={() => { setUnlockModal(null); setReason(''); }}
          title="Unlock Device"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Unlock device <strong>{unlockModal ? `${(unlockModal as Record<string, string>).device_brand || (unlockModal as Record<string, string>).brand} ${(unlockModal as Record<string, string>).device_model || (unlockModal as Record<string, string>).model}` : ''}</strong>?
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reason *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="e.g., Payment received, customer resolved..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setUnlockModal(null); setReason(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => unlockMutation.mutate()}
                disabled={!reason.trim() || unlockMutation.isPending}
              >
                {unlockMutation.isPending ? 'Unlocking...' : 'Confirm Unlock'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
