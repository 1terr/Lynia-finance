'use client';

import React, { useState } from 'react';
import type { DeviceWithRelations } from '@/types/database';

interface Distributor {
  id: string;
  business_name: string;
  contact_person: string;
  phone_number: string;
  province: string;
  city: string;
}

interface DistributorAssignmentProps {
  device: DeviceWithRelations;
  distributors: Distributor[];
  onAssign: (distributorId: string) => void;
  isLoading?: boolean;
}

export function DistributorAssignment({
  device,
  distributors,
  onAssign,
  isLoading,
}: DistributorAssignmentProps) {
  const [selectedDistributor, setSelectedDistributor] = useState(device.distributor_id || '');

  const handleAssign = () => {
    if (selectedDistributor) {
      onAssign(selectedDistributor);
    }
  };

  const currentDistributor = distributors.find((d) => d.id === device.distributor_id);
  const selectedDist = distributors.find((d) => d.id === selectedDistributor);
  const hasChanged = selectedDistributor !== (device.distributor_id || '');

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Distributor Assignment</h3>

      {currentDistributor && (
        <div className="mb-4 p-3 bg-muted rounded-md">
          <p className="text-sm font-medium text-foreground">Current: {currentDistributor.business_name}</p>
          <p className="text-xs text-muted-foreground">
            {currentDistributor.contact_person} &middot; {currentDistributor.phone_number}
          </p>
          <p className="text-xs text-muted-foreground">
            {currentDistributor.city}, {currentDistributor.province}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {currentDistributor ? 'Reassign to' : 'Assign to'}
          </label>
          <select
            value={selectedDistributor}
            onChange={(e) => setSelectedDistributor(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            aria-label="Select distributor"
          >
            <option value="">Select distributor...</option>
            {distributors.map((dist) => (
              <option key={dist.id} value={dist.id}>
                {dist.business_name} — {dist.city}, {dist.province}
              </option>
            ))}
          </select>
        </div>

        {selectedDist && hasChanged && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md text-sm">
            <p className="font-medium text-blue-900">{selectedDist.business_name}</p>
            <p className="text-blue-700 text-xs">
              {selectedDist.contact_person} &middot; {selectedDist.phone_number}
            </p>
            <p className="text-blue-700 text-xs">
              {selectedDist.city}, {selectedDist.province}
            </p>
          </div>
        )}

        <button
          onClick={handleAssign}
          disabled={!hasChanged || !selectedDistributor || isLoading}
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          {currentDistributor ? 'Reassign' : 'Assign'} Distributor
        </button>
      </div>
    </div>
  );
}
