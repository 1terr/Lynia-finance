'use client';

import React, { useState } from 'react';
import type { Device } from '@/types/database';

interface BulkOperationsProps {
  selectedCount: number;
  onBulkStatusChange: (status: Device['status']) => void;
  onBulkAssignDistributor: (distributorId: string) => void;
  onClearSelection: () => void;
  distributors: { id: string; business_name: string }[];
  isLoading?: boolean;
}

export function BulkOperations({
  selectedCount,
  onBulkStatusChange,
  onBulkAssignDistributor,
  onClearSelection,
  distributors,
  isLoading,
}: BulkOperationsProps) {
  const [bulkAction, setBulkAction] = useState('');
  const [bulkDistributor, setBulkDistributor] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  if (selectedCount === 0) return null;

  const handleApply = () => {
    if (bulkAction === 'assign_distributor' && bulkDistributor) {
      onBulkAssignDistributor(bulkDistributor);
    } else if (bulkAction && bulkAction !== 'assign_distributor') {
      onBulkStatusChange(bulkAction as Device['status']);
    }
    setShowConfirm(false);
    setBulkAction('');
    setBulkDistributor('');
  };

  return (
    <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 flex items-center gap-4 flex-wrap">
      <span className="text-sm font-medium text-primary-800">
        {selectedCount} device{selectedCount !== 1 ? 's' : ''} selected
      </span>

      <select
        value={bulkAction}
        onChange={(e) => { setBulkAction(e.target.value); setBulkDistributor(''); }}
        className="rounded-md border border-primary-300 px-3 py-1.5 text-sm bg-white"
        aria-label="Bulk action"
      >
        <option value="">Select action...</option>
        <option value="available">Set Available</option>
        <option value="reserved">Set Reserved</option>
        <option value="damaged">Set Damaged</option>
        <option value="returned">Set Returned</option>
        <option value="assign_distributor">Assign Distributor</option>
      </select>

      {bulkAction === 'assign_distributor' && (
        <select
          value={bulkDistributor}
          onChange={(e) => setBulkDistributor(e.target.value)}
          className="rounded-md border border-primary-300 px-3 py-1.5 text-sm bg-white"
          aria-label="Select distributor for bulk assignment"
        >
          <option value="">Select distributor...</option>
          {distributors.map((d) => (
            <option key={d.id} value={d.id}>{d.business_name}</option>
          ))}
        </select>
      )}

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!bulkAction || (bulkAction === 'assign_distributor' && !bulkDistributor) || isLoading}
          className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          Apply
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-primary-700">Confirm?</span>
          <button
            onClick={handleApply}
            disabled={isLoading}
            className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            Yes, Apply
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="px-3 py-1.5 bg-white text-gray-700 text-xs rounded-md border border-gray-300 hover:bg-gray-50"
          >
            No
          </button>
        </div>
      )}

      <button
        onClick={onClearSelection}
        className="text-sm text-primary-700 hover:text-primary-900 ml-auto"
      >
        Clear selection
      </button>
    </div>
  );
}
