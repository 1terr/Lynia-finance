'use client';

import React from 'react';
import type { DeviceInventorySummary } from '@/lib/api/devices';

interface DeviceSummaryCardsProps {
  summary: DeviceInventorySummary | null;
  loading?: boolean;
}

export function DeviceSummaryCards({ summary, loading }: DeviceSummaryCardsProps) {
  const cards = [
    { label: 'Total Devices', value: summary?.total_devices ?? 0, color: 'bg-blue-50 dark:bg-blue-950 text-blue-700' },
    { label: 'Available', value: summary?.available ?? 0, color: 'bg-green-50 dark:bg-green-950 text-green-700' },
    { label: 'Assigned', value: summary?.assigned ?? 0, color: 'bg-purple-50 dark:bg-purple-950 text-purple-700' },
    { label: 'Reserved', value: summary?.reserved ?? 0, color: 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700' },
    { label: 'Damaged', value: summary?.damaged ?? 0, color: 'bg-red-50 dark:bg-red-950 text-red-700' },
    { label: 'Returned', value: summary?.returned ?? 0, color: 'bg-muted text-foreground' },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-20 mb-2" />
            <div className="h-8 bg-muted rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-lg border border-border p-4 ${card.color}`}>
          <p className="text-xs font-medium opacity-75">{card.label}</p>
          <p className="text-2xl font-bold mt-1">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
