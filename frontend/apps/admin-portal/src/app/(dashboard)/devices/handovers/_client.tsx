'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { getDeviceHandovers, updateHandoverStatus, type DeviceHandoverRow } from '@/lib/api/devices';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { formatDate, formatDateTime, truncateId } from '@lynia/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Smartphone,
  Search,
  Filter,
  Package,
  User,
  ArrowRight,
} from 'lucide-react';

const statusConfig: Record<string, { label: string; variant: 'green' | 'yellow' | 'blue' | 'red' | 'gray' }> = {
  initiated: { label: 'Initiated', variant: 'yellow' },
  identity_verified: { label: 'ID Verified', variant: 'blue' },
  deposit_verified: { label: 'Deposit Verified', variant: 'blue' },
  device_inspected: { label: 'Inspected', variant: 'blue' },
  completed: { label: 'Completed', variant: 'green' },
  cancelled: { label: 'Cancelled', variant: 'red' },
};

/** Valid status transitions for the handover workflow */
const nextStatusMap: Record<string, { next: DeviceHandoverRow['status']; label: string; description: string }> = {
  initiated: {
    next: 'identity_verified',
    label: 'Verify Identity',
    description: 'Confirm that the customer\'s identity has been verified. This will advance the handover to the next step.',
  },
  identity_verified: {
    next: 'deposit_verified',
    label: 'Verify Deposit',
    description: 'Confirm that the customer\'s deposit payment has been received and verified.',
  },
  deposit_verified: {
    next: 'device_inspected',
    label: 'Mark Inspected',
    description: 'Confirm that the device has been physically inspected and is in good condition for handover.',
  },
  device_inspected: {
    next: 'completed',
    label: 'Complete Handover',
    description: 'Mark this handover as completed. The device will be transferred to the customer.',
  },
};

export default function HandoversPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [transitionTarget, setTransitionTarget] = useState<{
    handover: DeviceHandoverRow;
    nextStatus: DeviceHandoverRow['status'];
    label: string;
    description: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['device-handovers', page, statusFilter, search],
    queryFn: () => getDeviceHandovers({ status: statusFilter || undefined, search: search || undefined, page }),
    refetchInterval: 30000,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeviceHandoverRow['status'] }) =>
      updateHandoverStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-handovers'] });
      toast({ title: 'Handover status updated', variant: 'success' });
      setTransitionTarget(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update handover', description: error.message, variant: 'error' });
    },
  });

  const handovers = data?.data || [];

  return (
    <ProtectedRoute requiredPermission={{ resource: 'devices', action: 'read' }}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/devices" className="text-sm text-gray-500 hover:text-gray-700">
                Devices
              </Link>
              <span className="text-gray-300">/</span>
              <span className="text-sm text-gray-700">Handovers</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">Device Handovers</h1>
            <p className="mt-1 text-sm text-gray-500">
              Schedule and track device handovers to customers
            </p>
          </div>
          {data && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                {data.total} total
              </span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer name or IMEI..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Statuses</option>
              <option value="initiated">Initiated</option>
              <option value="identity_verified">ID Verified</option>
              <option value="deposit_verified">Deposit Verified</option>
              <option value="device_inspected">Inspected</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : handovers.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <Smartphone className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-lg font-medium text-gray-500">No handovers found</p>
            <p className="mt-1 text-sm text-gray-400">
              {statusFilter || search
                ? 'Try adjusting your filters.'
                : 'No device handovers have been initiated yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Device</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Distributor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Scheduled</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {handovers.map((h: DeviceHandoverRow) => {
                  const customer = Array.isArray(h.customer) ? h.customer[0] : h.customer;
                  const device = Array.isArray(h.device) ? h.device[0] : h.device;
                  const distributor = Array.isArray(h.distributor) ? h.distributor[0] : h.distributor;
                  const status = statusConfig[h.status] || statusConfig.initiated;
                  const transition = nextStatusMap[h.status];
                  return (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {customer
                                ? `${(customer as Record<string, string>).first_name} ${(customer as Record<string, string>).last_name}`
                                : truncateId(h.customer_id)}
                            </p>
                            {customer && (
                              <p className="text-xs text-gray-500">{(customer as Record<string, string>).phone_number}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {device ? (
                          <div>
                            <p className="text-sm text-gray-900">
                              {(device as Record<string, string>).brand} {(device as Record<string, string>).model}
                            </p>
                            <p className="text-xs text-gray-500">{(device as Record<string, string>).imei || 'No IMEI'}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">{truncateId(h.device_id)}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {distributor
                          ? (distributor as Record<string, string>).business_name
                          : truncateId(h.distributor_id)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {h.scheduled_date
                          ? `${formatDate(h.scheduled_date)}${h.scheduled_time ? ` ${h.scheduled_time}` : ''}`
                          : 'Not scheduled'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDateTime(h.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {transition ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTransitionTarget({
                              handover: h,
                              nextStatus: transition.next,
                              label: transition.label,
                              description: transition.description,
                            })}
                          >
                            {transition.label}
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        ) : null}
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

        {/* Status Transition Confirmation Dialog */}
        <ConfirmationDialog
          open={!!transitionTarget}
          onClose={() => setTransitionTarget(null)}
          onConfirm={() => {
            if (transitionTarget) {
              transitionMutation.mutate({
                id: transitionTarget.handover.id,
                status: transitionTarget.nextStatus,
              });
            }
          }}
          title={transitionTarget?.label || ''}
          description={transitionTarget?.description || ''}
          confirmLabel={transitionTarget?.label || 'Confirm'}
          variant="warning"
          isLoading={transitionMutation.isPending}
        />
      </div>
    </ProtectedRoute>
  );
}
