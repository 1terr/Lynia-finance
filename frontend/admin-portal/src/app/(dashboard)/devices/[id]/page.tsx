'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DeviceDetail } from '@/components/devices/DeviceDetail';
import { LockControlPanel } from '@/components/devices/LockControlPanel';
import { DistributorAssignment } from '@/components/devices/DistributorAssignment';
import { DeviceTimeline } from '@/components/devices/DeviceTimeline';
import { HandoverTracking } from '@/components/devices/HandoverTracking';
import {
  fetchDeviceById,
  fetchDeviceLockHistory,
  fetchDeviceHandovers,
  fetchDistributors,
  lockDevice,
  unlockDevice,
  permanentUnlockDevice,
  assignDistributor,
  updateHandoverStatus,
  completeHandover,
} from '@/lib/api/devices';

export default function DeviceDetailPage() {
  const params = useParams();
  const deviceId = params.id as string;
  const queryClient = useQueryClient();

  const { data: device, isLoading } = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => fetchDeviceById(deviceId),
  });

  const { data: lockHistory = [] } = useQuery({
    queryKey: ['device-lock-history', deviceId],
    queryFn: () => fetchDeviceLockHistory(deviceId),
  });

  const { data: handovers = [] } = useQuery({
    queryKey: ['device-handovers', deviceId],
    queryFn: () => fetchDeviceHandovers({ device_id: deviceId }),
  });

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: fetchDistributors,
  });

  const lockMutation = useMutation({
    mutationFn: ({ assignmentId, reason }: { assignmentId: string; reason: string }) =>
      lockDevice(assignmentId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['device-lock-history', deviceId] });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (assignmentId: string) => unlockDevice(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['device-lock-history', deviceId] });
    },
  });

  const permanentUnlockMutation = useMutation({
    mutationFn: (assignmentId: string) => permanentUnlockDevice(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['device-lock-history', deviceId] });
    },
  });

  const assignDistributorMutation = useMutation({
    mutationFn: (distributorId: string) => assignDistributor(deviceId, distributorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
    },
  });

  const handoverStatusMutation = useMutation({
    mutationFn: ({ handoverId, step }: { handoverId: string; step: string }) =>
      updateHandoverStatus(handoverId, { status: step as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-handovers', deviceId] });
    },
  });

  const completeHandoverMutation = useMutation({
    mutationFn: (handoverId: string) => completeHandover(handoverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-handovers', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading device details...</div>;
  }

  if (!device) {
    return <div className="p-8 text-center text-gray-500">Device not found</div>;
  }

  const activeAssignment = device.device_assignments?.find(
    (a) => !a.returned && !a.repossessed
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/devices" className="hover:text-primary-600">Devices</Link>
        <span>/</span>
        <span className="text-gray-900">{device.brand} {device.model}</span>
      </div>

      {/* Device Detail */}
      <DeviceDetail device={device} />

      {/* Tabs */}
      <Tabs defaultTab="lock-control">
        <TabsList>
          <TabsTrigger tab="lock-control">Lock Control</TabsTrigger>
          <TabsTrigger tab="handovers">Handovers</TabsTrigger>
          <TabsTrigger tab="distributor">Distributor</TabsTrigger>
          <TabsTrigger tab="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent tab="lock-control">
          {activeAssignment ? (
            <LockControlPanel
              assignment={activeAssignment}
              lockHistory={lockHistory}
              onLock={(reason) =>
                lockMutation.mutate({ assignmentId: activeAssignment.id, reason })
              }
              onUnlock={() => unlockMutation.mutate(activeAssignment.id)}
              onPermanentUnlock={() => permanentUnlockMutation.mutate(activeAssignment.id)}
              isLoading={lockMutation.isPending || unlockMutation.isPending || permanentUnlockMutation.isPending}
            />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
              <p>No active assignment for this device.</p>
              <p className="text-sm mt-1">Lock controls are only available when a device is assigned to a customer.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent tab="handovers">
          <HandoverTracking
            handovers={handovers}
            onUpdateStatus={(handoverId, step) =>
              handoverStatusMutation.mutate({ handoverId, step })
            }
            onComplete={(handoverId) => completeHandoverMutation.mutate(handoverId)}
            isLoading={handoverStatusMutation.isPending || completeHandoverMutation.isPending}
          />
        </TabsContent>

        <TabsContent tab="distributor">
          <DistributorAssignment
            device={device}
            distributors={distributors}
            onAssign={(distributorId) => assignDistributorMutation.mutate(distributorId)}
            isLoading={assignDistributorMutation.isPending}
          />
        </TabsContent>

        <TabsContent tab="timeline">
          <DeviceTimeline
            lockEvents={lockHistory}
            assignments={device.device_assignments || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
