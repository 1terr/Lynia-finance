'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { formatDateTime } from '@lynia/utils';
import { useToast } from '@/hooks/use-toast';
import type { DeviceAssignment, DeviceLockEvent } from '@/types/database';

interface LockControlPanelProps {
  assignment: DeviceAssignment;
  lockHistory: DeviceLockEvent[];
  onLock: (reason: string) => void;
  onUnlock: () => void;
  onPermanentUnlock: () => void;
  isLoading?: boolean;
}

export function LockControlPanel({
  assignment,
  lockHistory,
  onLock,
  onUnlock,
  onPermanentUnlock,
  isLoading,
}: LockControlPanelProps) {
  const { toast } = useToast();
  const [lockReason, setLockReason] = useState('');
  const [showLockForm, setShowLockForm] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [showConfirmPermanent, setShowConfirmPermanent] = useState(false);
  const [permanentUnlockText, setPermanentUnlockText] = useState('');

  const handleLock = () => {
    if (lockReason.trim()) {
      onLock(lockReason.trim());
      setLockReason('');
      setShowLockForm(false);
      toast({ title: 'Device locked successfully', variant: 'success' });
    }
  };

  const handleUnlock = () => {
    onUnlock();
    setShowUnlockConfirm(false);
    toast({ title: 'Device unlocked successfully', variant: 'success' });
  };

  const lockStatusConfig: Record<string, { label: string; color: string }> = {
    unlocked: { label: 'Unlocked', color: 'text-green-700 bg-green-50 dark:bg-green-950' },
    locked: { label: 'Locked', color: 'text-orange-700 bg-orange-50 dark:bg-orange-950' },
    permanent_unlock: { label: 'Permanently Unlocked', color: 'text-blue-700 bg-blue-50 dark:bg-blue-950' },
  };

  const statusInfo = lockStatusConfig[assignment.lock_status] || lockStatusConfig.unlocked;

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Device Lock Status</h3>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {assignment.lock_status === 'locked' && assignment.locked_reason && (
              <span className="text-sm text-muted-foreground">Reason: {assignment.locked_reason}</span>
            )}
          </div>
          {assignment.grace_period_ends_at && assignment.lock_status !== 'locked' && (
            <span className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-950 px-2 py-1 rounded">
              Grace period ends: {formatDateTime(assignment.grace_period_ends_at)}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {assignment.lock_status === 'unlocked' && (
            <>
              <button
                onClick={() => setShowLockForm(true)}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Lock Device
              </button>
              <button
                onClick={() => setShowConfirmPermanent(true)}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Permanent Unlock
              </button>
            </>
          )}
          {assignment.lock_status === 'locked' && (
            <button
              onClick={() => setShowUnlockConfirm(true)}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Unlock Device
            </button>
          )}
          {assignment.lock_status === 'permanent_unlock' && (
            <p className="text-sm text-muted-foreground">This device has been permanently unlocked and cannot be re-locked.</p>
          )}
        </div>

        {/* Lock Form */}
        {showLockForm && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-md border border-red-200">
            <label className="block text-sm font-medium text-red-800 mb-1">Lock Reason</label>
            <textarea
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              placeholder="Enter reason for locking the device..."
              className="w-full rounded-md border border-red-300 px-3 py-2 text-sm mb-2"
              rows={2}
              maxLength={500}
            />
            <div className="flex gap-2">
              <button
                onClick={handleLock}
                disabled={!lockReason.trim() || isLoading}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Lock
              </button>
              <button
                onClick={() => { setShowLockForm(false); setLockReason(''); }}
                className="px-3 py-1.5 bg-card text-foreground text-sm rounded-md border border-border hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Permanent Unlock Confirmation — Two-Step */}
        {showConfirmPermanent && (
          <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
            <div className="flex items-start gap-2 mb-3">
              <span className="mt-0.5 text-blue-600 font-bold">⚠</span>
              <div>
                <p className="text-sm font-medium text-blue-900">This action cannot be undone</p>
                <p className="text-sm text-blue-800 mt-1">
                  Permanently unlocking this device means it can <strong>never</strong> be remotely locked again.
                  This is typically done when a loan is fully paid off.
                </p>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-blue-800 mb-1">
                Type <span className="font-mono font-bold">PERMANENTLY UNLOCK</span> to confirm
              </label>
              <input
                type="text"
                value={permanentUnlockText}
                onChange={(e) => setPermanentUnlockText(e.target.value)}
                placeholder="PERMANENTLY UNLOCK"
                className="w-full rounded-md border border-blue-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { onPermanentUnlock(); setShowConfirmPermanent(false); setPermanentUnlockText(''); }}
                disabled={isLoading || permanentUnlockText !== 'PERMANENTLY UNLOCK'}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Permanent Unlock
              </button>
              <button
                onClick={() => { setShowConfirmPermanent(false); setPermanentUnlockText(''); }}
                className="px-3 py-1.5 bg-card text-foreground text-sm rounded-md border border-border hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lock History */}
      {lockHistory.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Lock History</h3>
          <div className="space-y-3">
            {lockHistory.map((event) => (
              <div key={event.id} className="flex items-start gap-3 text-sm">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  event.action === 'lock' ? 'bg-red-50 dark:bg-red-9500' : 'bg-green-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {event.action === 'lock' ? 'Locked' : 'Unlocked'}
                    </span>
                    <Badge variant={
                      event.trigger_type === 'automated' ? 'yellow' :
                      event.trigger_type === 'payment' ? 'green' : 'blue'
                    }>
                      {event.trigger_type}
                    </Badge>
                    <Badge variant={event.trustonic_status === 'success' ? 'green' : 'red'}>
                      {event.trustonic_status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5">{event.reason}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDateTime(event.performed_at)} by {event.triggered_by}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unlock Confirmation Dialog */}
      <ConfirmationDialog
        open={showUnlockConfirm}
        onClose={() => setShowUnlockConfirm(false)}
        onConfirm={handleUnlock}
        title="Unlock Device"
        description="This device will be unlocked. The customer will regain full access."
        confirmLabel="Unlock Device"
        variant="warning"
        isLoading={isLoading}
      />
    </div>
  );
}
