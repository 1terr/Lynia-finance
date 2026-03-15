'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { getDevices, lockDevice, unlockDevice, getDeviceStats, type DeviceWithCustomer, type DeviceStats } from '@/lib/api/devices';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/lib/auth/context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { truncateId } from '@lynia/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Lock,
  Unlock,
  Search,
  Filter,
  Shield,
  ShieldOff,
  Smartphone,
  X,
} from 'lucide-react';

export default function LockUnlockPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [lockStatusFilter, setLockStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [lockModal, setLockModal] = useState<DeviceWithCustomer | null>(null);
  const [unlockModal, setUnlockModal] = useState<DeviceWithCustomer | null>(null);
  const [reason, setReason] = useState('');

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<'lock' | 'unlock' | null>(null);
  const [batchReason, setBatchReason] = useState('');
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; failed: number } | null>(null);

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
      toast({ title: 'Device locked successfully', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to lock device', description: error.message, variant: 'error' });
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
      toast({ title: 'Device unlocked successfully', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to unlock device', description: error.message, variant: 'error' });
    },
  });

  const devices = data?.data || [];

  // Selection helpers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const pageIds = devices.map((d) => d.id);
    setSelectedIds((prev) => {
      const allSelected = pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [devices]);

  const selectedDevices = devices.filter((d) => selectedIds.has(d.id));
  const selectedLocked = selectedDevices.filter((d) => d.lock_status === 'locked');
  const selectedUnlocked = selectedDevices.filter((d) => d.lock_status !== 'locked');
  const allPageSelected = devices.length > 0 && devices.every((d) => selectedIds.has(d.id));
  const somePageSelected = !allPageSelected && devices.some((d) => selectedIds.has(d.id));

  // Batch execution
  const executeBatch = useCallback(async () => {
    if (!user || !batchAction || !batchReason.trim()) return;
    const targets = batchAction === 'lock' ? selectedUnlocked : selectedLocked;
    const total = targets.length;
    let failed = 0;
    const failedIds = new Set<string>();

    setBatchProgress({ current: 0, total, failed: 0 });

    for (let i = 0; i < targets.length; i++) {
      try {
        if (batchAction === 'lock') {
          await lockDevice(targets[i].id, user.id, batchReason);
        } else {
          await unlockDevice(targets[i].id, user.id, batchReason);
        }
      } catch {
        failed++;
        failedIds.add(targets[i].id);
      }
      setBatchProgress({ current: i + 1, total, failed });
    }

    queryClient.invalidateQueries({ queryKey: ['devices-lock'] });
    queryClient.invalidateQueries({ queryKey: ['device-stats'] });

    const succeeded = total - failed;
    const action = batchAction === 'lock' ? 'locked' : 'unlocked';
    if (failed === 0) {
      toast({ title: `Successfully ${action} ${succeeded} device${succeeded > 1 ? 's' : ''}`, variant: 'success' });
      setSelectedIds(new Set());
    } else {
      toast({
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${succeeded}/${total} devices. ${failed} failed.`,
        variant: 'error',
      });
      setSelectedIds(failedIds);
    }

    setBatchAction(null);
    setBatchReason('');
    setBatchProgress(null);
  }, [user, batchAction, batchReason, selectedLocked, selectedUnlocked, queryClient, toast]);

  return (
    <ProtectedRoute requiredPermission={{ resource: 'devices', action: 'lock' }}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/devices" className="text-sm text-muted-foreground hover:text-foreground">
              Devices
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-foreground">Lock/Unlock</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Device Lock/Unlock</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Remotely control device lock status
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-card p-4 shadow">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-50 dark:bg-red-950 p-2">
                  <Lock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Locked Devices</p>
                  <p className="text-lg font-semibold text-red-600">{stats.locked}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-card p-4 shadow">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 dark:bg-green-950 p-2">
                  <Unlock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sold/Active Devices</p>
                  <p className="text-lg font-semibold text-green-600">{stats.sold}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-card p-4 shadow">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-2">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Assigned</p>
                  <p className="text-lg font-semibold">{stats.assigned + stats.sold}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by IMEI, brand, model, or customer phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-border py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={lockStatusFilter}
              onChange={(e) => { setLockStatusFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-border py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Lock States</option>
              <option value="locked">Locked</option>
              <option value="unlocked">Unlocked</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Batch action toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
            <span className="text-sm font-medium text-brand-700">
              {selectedIds.size} selected
            </span>
            {selectedUnlocked.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setBatchAction('lock')}
              >
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                Lock {selectedUnlocked.length} Device{selectedUnlocked.length > 1 ? 's' : ''}
              </Button>
            )}
            {selectedLocked.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchAction('unlock')}
              >
                <Unlock className="mr-1.5 h-3.5 w-3.5" />
                Unlock {selectedLocked.length} Device{selectedLocked.length > 1 ? 's' : ''}
              </Button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}

        {/* Device Table */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="rounded-lg bg-card p-12 text-center shadow">
            <Smartphone className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">No devices found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search || lockStatusFilter ? 'Try adjusting your filters.' : 'No devices in the system.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-card shadow">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Device</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">IMEI</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Lock Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {devices.map((device: DeviceWithCustomer) => {
                  const customer = Array.isArray(device.customer) ? device.customer[0] : device.customer;
                  const isLocked = device.lock_status === 'locked';
                  const isSelected = selectedIds.has(device.id);
                  return (
                    <tr key={device.id} className={isSelected ? 'bg-brand-50' : 'hover:bg-accent'}>
                      <td className="w-10 px-3 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(device.id)}
                          className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link href={`/devices/${device.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                          {device.manufacturer} {device.model}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground font-mono">
                        {device.imei || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {customer ? (
                          <div>
                            <p className="text-sm text-foreground">{customer.full_name}</p>
                            <p className="text-xs text-muted-foreground">{customer.phone_number}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Badge variant={device.status === 'sold' ? 'green' : 'gray'}>
                          {device.status}
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

        {/* Single Lock Modal */}
        <Modal
          open={!!lockModal}
          onClose={() => { setLockModal(null); setReason(''); }}
          title="Lock Device"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Lock device <strong>{lockModal ? `${lockModal.manufacturer} ${lockModal.model}` : ''}</strong>?
              The device will be remotely locked and unusable until unlocked.
            </p>
            <div>
              <label className="block text-sm font-medium text-foreground">Reason *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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

        {/* Single Unlock Modal */}
        <Modal
          open={!!unlockModal}
          onClose={() => { setUnlockModal(null); setReason(''); }}
          title="Unlock Device"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Unlock device <strong>{unlockModal ? `${unlockModal.manufacturer} ${unlockModal.model}` : ''}</strong>?
            </p>
            <div>
              <label className="block text-sm font-medium text-foreground">Reason *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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

        {/* Batch Lock/Unlock Modal */}
        <Modal
          open={!!batchAction}
          onClose={() => { if (!batchProgress) { setBatchAction(null); setBatchReason(''); } }}
          title={batchAction === 'lock' ? 'Batch Lock Devices' : 'Batch Unlock Devices'}
        >
          <div className="space-y-4">
            {batchProgress ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {batchAction === 'lock' ? 'Locking' : 'Unlocking'} device {batchProgress.current} of {batchProgress.total}...
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
                {batchProgress.failed > 0 && (
                  <p className="text-xs text-red-600">{batchProgress.failed} failed so far</p>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm font-medium text-foreground">
                    {batchAction === 'lock'
                      ? `${selectedUnlocked.length} device${selectedUnlocked.length > 1 ? 's' : ''} will be locked`
                      : `${selectedLocked.length} device${selectedLocked.length > 1 ? 's' : ''} will be unlocked`
                    }
                  </p>
                  <ul className="mt-2 space-y-1">
                    {(batchAction === 'lock' ? selectedUnlocked : selectedLocked).slice(0, 5).map((d) => (
                      <li key={d.id} className="text-xs text-muted-foreground">
                        <span className="font-mono">{d.imei}</span> — {d.manufacturer} {d.model}
                      </li>
                    ))}
                    {(batchAction === 'lock' ? selectedUnlocked.length : selectedLocked.length) > 5 && (
                      <li className="text-xs text-muted-foreground">
                        and {(batchAction === 'lock' ? selectedUnlocked.length : selectedLocked.length) - 5} more...
                      </li>
                    )}
                  </ul>
                </div>
                {batchAction === 'lock' && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3">
                    <p className="text-xs text-red-700">
                      These devices will be remotely locked and unusable until unlocked.
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground">Reason *</label>
                  <textarea
                    value={batchReason}
                    onChange={(e) => setBatchReason(e.target.value)}
                    rows={3}
                    required
                    className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder={batchAction === 'lock'
                      ? 'e.g., Batch lock for missed payments...'
                      : 'e.g., Batch unlock — payments received...'
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setBatchAction(null); setBatchReason(''); }}>
                    Cancel
                  </Button>
                  <Button
                    variant={batchAction === 'lock' ? 'danger' : 'primary'}
                    onClick={executeBatch}
                    disabled={!batchReason.trim()}
                  >
                    {batchAction === 'lock'
                      ? `Lock ${selectedUnlocked.length} Device${selectedUnlocked.length > 1 ? 's' : ''}`
                      : `Unlock ${selectedLocked.length} Device${selectedLocked.length > 1 ? 's' : ''}`
                    }
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
