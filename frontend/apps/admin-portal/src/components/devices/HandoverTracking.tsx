'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime } from '@lynia/utils';
import type { HandoverWithRelations } from '@/lib/api/devices';

interface HandoverTrackingProps {
  handovers: HandoverWithRelations[];
  onUpdateStatus?: (handoverId: string, step: string) => void;
  onComplete?: (handoverId: string) => void;
  onCancel?: (handoverId: string) => void;
  isLoading?: boolean;
}

const statusSteps = [
  { key: 'initiated', label: 'Initiated' },
  { key: 'identity_verified', label: 'ID Verified' },
  { key: 'deposit_verified', label: 'Deposit Verified' },
  { key: 'device_inspected', label: 'Device Inspected' },
  { key: 'completed', label: 'Completed' },
];

const statusConfig: Record<string, { variant: 'green' | 'yellow' | 'blue' | 'red' | 'gray' | 'purple' }> = {
  initiated: { variant: 'yellow' },
  identity_verified: { variant: 'blue' },
  deposit_verified: { variant: 'blue' },
  device_inspected: { variant: 'blue' },
  completed: { variant: 'green' },
  cancelled: { variant: 'red' },
};

function getStepIndex(status: string): number {
  const idx = statusSteps.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : -1;
}

export function HandoverTracking({
  handovers,
  onUpdateStatus,
  onComplete,
  onCancel,
  isLoading,
}: HandoverTrackingProps) {
  if (handovers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No handovers found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {handovers.map((handover) => {
        const currentStep = getStepIndex(handover.status);
        const isCancelled = handover.status === 'cancelled';
        const isCompleted = handover.status === 'completed';

        return (
          <div key={handover.id} className="bg-card rounded-lg border border-border p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    {handover.customers?.first_name} {handover.customers?.last_name}
                  </h4>
                  <Badge variant={statusConfig[handover.status]?.variant || 'gray'}>
                    {handover.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {handover.devices?.brand} {handover.devices?.model}
                  {handover.devices?.imei && ` (IMEI: ${handover.devices.imei})`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Distributor: {handover.distributors?.business_name || '—'}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {handover.scheduled_date && (
                  <p>Scheduled: {formatDate(handover.scheduled_date)} at {handover.scheduled_time}</p>
                )}
                {handover.completed_at && (
                  <p>Completed: {formatDateTime(handover.completed_at)}</p>
                )}
              </div>
            </div>

            {/* Progress Steps */}
            {!isCancelled && (
              <div className="flex items-center gap-1 mb-4">
                {statusSteps.map((step, idx) => (
                  <React.Fragment key={step.key}>
                    <div className={`flex items-center gap-1.5 ${idx <= currentStep ? 'text-primary-600' : 'text-muted-foreground'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        idx < currentStep ? 'bg-primary-600 text-white' :
                        idx === currentStep ? 'bg-primary-100 text-primary-700 border-2 border-primary-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {idx < currentStep ? '✓' : idx + 1}
                      </div>
                      <span className="text-xs hidden sm:inline">{step.label}</span>
                    </div>
                    {idx < statusSteps.length - 1 && (
                      <div className={`flex-1 h-0.5 ${idx < currentStep ? 'bg-primary-600' : 'bg-muted'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Checklist */}
            <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
              <div className={`flex items-center gap-1.5 ${handover.identity_verified ? 'text-green-700' : 'text-muted-foreground'}`}>
                <span>{handover.identity_verified ? '✓' : '○'}</span>
                <span>Identity Verified</span>
              </div>
              <div className={`flex items-center gap-1.5 ${handover.deposit_verified ? 'text-green-700' : 'text-muted-foreground'}`}>
                <span>{handover.deposit_verified ? '✓' : '○'}</span>
                <span>Deposit Verified</span>
              </div>
              <div className={`flex items-center gap-1.5 ${handover.device_inspected ? 'text-green-700' : 'text-muted-foreground'}`}>
                <span>{handover.device_inspected ? '✓' : '○'}</span>
                <span>Device Inspected</span>
              </div>
            </div>

            {handover.notes && (
              <p className="text-xs text-muted-foreground bg-muted rounded p-2 mb-3">
                Notes: {handover.notes}
              </p>
            )}

            {/* Actions */}
            {!isCompleted && !isCancelled && onUpdateStatus && (
              <div className="flex gap-2 pt-2 border-t border-border">
                {currentStep < statusSteps.length - 1 && (
                  <button
                    onClick={() => onUpdateStatus(handover.id, statusSteps[currentStep + 1].key)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    Next: {statusSteps[currentStep + 1]?.label}
                  </button>
                )}
                {onComplete && currentStep === statusSteps.length - 2 && (
                  <button
                    onClick={() => onComplete(handover.id)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Complete Handover
                  </button>
                )}
                {onCancel && (
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel this handover?')) {
                        onCancel(handover.id);
                      }
                    }}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-card text-red-600 text-xs rounded-md border border-red-300 hover:bg-red-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
