'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@lynia/utils';
import type { DeviceLockEvent, DeviceAssignment } from '@/types/database';

interface TimelineItem {
  id: string;
  type: 'lock' | 'unlock' | 'assignment' | 'return' | 'status_change';
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  variant: 'green' | 'red' | 'blue' | 'yellow' | 'gray' | 'purple';
}

interface DeviceTimelineProps {
  lockEvents: DeviceLockEvent[];
  assignments: DeviceAssignment[];
}

function buildTimeline(lockEvents: DeviceLockEvent[], assignments: DeviceAssignment[]): TimelineItem[] {
  const items: TimelineItem[] = [];

  lockEvents.forEach((event) => {
    items.push({
      id: event.id,
      type: event.action,
      title: event.action === 'lock' ? 'Device Locked' : 'Device Unlocked',
      description: event.reason,
      timestamp: event.performed_at,
      actor: event.triggered_by,
      variant: event.action === 'lock' ? 'red' : 'green',
    });
  });

  assignments.forEach((assignment) => {
    items.push({
      id: `assign-${assignment.id}`,
      type: 'assignment',
      title: 'Device Assigned',
      description: `Assigned to customer ${assignment.customer_id} via loan ${assignment.loan_id}. IMEI: ${assignment.imei}`,
      timestamp: assignment.assigned_at,
      actor: assignment.verified_by || 'system',
      variant: 'blue',
    });

    if (assignment.returned && assignment.returned_at) {
      items.push({
        id: `return-${assignment.id}`,
        type: 'return',
        title: 'Device Returned',
        description: `Return reason: ${assignment.return_reason || 'N/A'}. Condition: ${assignment.return_condition || 'N/A'}`,
        timestamp: assignment.returned_at,
        actor: 'system',
        variant: 'yellow',
      });
    }

    if (assignment.repossessed && assignment.repossessed_at) {
      items.push({
        id: `repossess-${assignment.id}`,
        type: 'return',
        title: 'Device Repossessed',
        description: 'Device was repossessed due to loan default',
        timestamp: assignment.repossessed_at,
        actor: 'system',
        variant: 'red',
      });
    }
  });

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return items;
}

export function DeviceTimeline({ lockEvents, assignments }: DeviceTimelineProps) {
  const timeline = buildTimeline(lockEvents, assignments);

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No history events found for this device
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {timeline.map((item) => (
        <div key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
              item.variant === 'red' ? 'bg-red-500' :
              item.variant === 'green' ? 'bg-green-500' :
              item.variant === 'blue' ? 'bg-blue-500' :
              item.variant === 'yellow' ? 'bg-yellow-500' :
              'bg-gray-400'
            }`} />
            <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{item.title}</span>
              <Badge variant={item.variant}>{item.type}</Badge>
            </div>
            <p className="text-sm text-gray-600 mt-0.5">{item.description}</p>
            <p className="text-xs text-gray-400 mt-1">
              {formatDateTime(item.timestamp)} &middot; by {item.actor}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
