'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@lynia/utils';
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
  const [lockReason, setLockReason] = useState('');
  const [showLockForm, setShowLockForm] = useState(false);
  const [showConfirmPermanent, setShowConfirmPermanent] = useState(false);

  const handleLock = () => {
    if (lockReason.trim()) {
      onLock(lockReason.trim());
      setLockReason('');
      setShowLockForm(false);
    }
  };

  const lockStatusConfig: Record<string, { label: string; color: string }> = {
    unlocked: { label: 'Unlocked', color: 'text-green-700 bg-green-50' },
    locked: { label: 'Locked', color: 'text-orange-700 bg-orange-50' },
    permanent_unlock: { label: 'Permanently Unlocked', color: 'text-blue-700 bg-blue-50' },
  };

  const statusInfo = lockStatusConfig[assignment.lock_status] || lockStatusConfig.unlocked;

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Device Lock Status</h3>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {assignment.lock_status === 'locked' && assignment.locked_reason && (
              <span className="text-sm text-gray-500">Reason: {assignment.locked_reason}</span>
            )}
          </div>
          {assignment.grace_period_ends_at && assignment.lock_status !== 'locked' && (
            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
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
              onClick={onUnlock}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Unlock Device
            </button>
          )}
          {assignment.lock_status === 'permanent_unlock' && (
            <p className="text-sm text-gray-500">This device has been permanently unlocked and cannot be re-locked.</p>
          )}
        </div>

        {/* Lock Form */}
        {showLockForm && (
          <div className="mt-4 p-3 bg-red-50 rounded-md border border-red-200">
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
                className="px-3 py-1.5 bg-white text-gray-700 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Permanent Unlock Confirmation */}
        {showConfirmPermanent && (
          <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
            <p className="text-sm text-blue-800 mb-2">
              Are you sure? Permanently unlocking this device means it can no longer be remotely locked.
              This is typically done when a loan is fully paid off.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { onPermanentUnlock(); setShowConfirmPermanent(false); }}
                disabled={isLoading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Confirm Permanent Unlock
              </button>
              <button
                onClick={() => setShowConfirmPermanent(false)}
                className="px-3 py-1.5 bg-white text-gray-700 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lock History */}
      {lockHistory.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Lock History</h3>
          <div className="space-y-3">
            {lockHistory.map((event) => (
              <div key={event.id} className="flex items-start gap-3 text-sm">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  event.action === 'lock' ? 'bg-red-500' : 'bg-green-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
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
                  <p className="text-gray-600 mt-0.5">{event.reason}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDateTime(event.performed_at)} by {event.triggered_by}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
