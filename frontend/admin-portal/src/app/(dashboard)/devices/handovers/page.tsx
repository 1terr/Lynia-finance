'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { HandoverTracking } from '@/components/devices/HandoverTracking';
import { HandoverScheduleForm } from '@/components/devices/HandoverScheduleForm';
import {
  fetchDeviceHandovers,
  scheduleHandover,
  updateHandoverStatus,
  completeHandover,
} from '@/lib/api/devices';

export default function HandoversPage() {
  const queryClient = useQueryClient();
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: handovers = [], isLoading } = useQuery({
    queryKey: ['handovers', statusFilter],
    queryFn: () => fetchDeviceHandovers({ status: statusFilter || undefined }),
    refetchInterval: 30000,
  });

  const scheduleMutation = useMutation({
    mutationFn: scheduleHandover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      setShowScheduleForm(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ handoverId, step }: { handoverId: string; step: string }) =>
      updateHandoverStatus(handoverId, { status: step as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeHandover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (handoverId: string) =>
      updateHandoverStatus(handoverId, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
    },
  });

  const pendingCount = handovers.filter(
    (h) => h.status !== 'completed' && h.status !== 'cancelled'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/devices" className="hover:text-primary-600">Devices</Link>
          <span>/</span>
          <span className="text-gray-900">Handovers</span>
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <button
          onClick={() => setShowScheduleForm(!showScheduleForm)}
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700"
        >
          {showScheduleForm ? 'Close' : 'Schedule Handover'}
        </button>
      </div>

      {/* Schedule Form */}
      {showScheduleForm && (
        <HandoverScheduleForm
          onSubmit={(data) => scheduleMutation.mutate(data)}
          onCancel={() => setShowScheduleForm(false)}
          isLoading={scheduleMutation.isPending}
        />
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          aria-label="Filter by handover status"
        >
          <option value="">All Handovers</option>
          <option value="initiated">Initiated</option>
          <option value="identity_verified">ID Verified</option>
          <option value="deposit_verified">Deposit Verified</option>
          <option value="device_inspected">Device Inspected</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Handover List */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Loading handovers...</div>
      ) : (
        <HandoverTracking
          handovers={handovers}
          onUpdateStatus={(handoverId, step) =>
            statusMutation.mutate({ handoverId, step })
          }
          onComplete={(handoverId) => completeMutation.mutate(handoverId)}
          onCancel={(handoverId) => cancelMutation.mutate(handoverId)}
          isLoading={statusMutation.isPending || completeMutation.isPending || cancelMutation.isPending}
        />
      )}
    </div>
  );
}
