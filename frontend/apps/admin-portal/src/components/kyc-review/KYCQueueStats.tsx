'use client';

import { ClipboardList, Clock, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@lynia/utils';

interface KYCQueueStatsProps {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  className?: string;
}

export function KYCQueueStats({
  total,
  pending,
  approved,
  rejected,
  className,
}: KYCQueueStatsProps) {
  const stats = [
    {
      label: 'Total Submissions',
      value: total,
      icon: ClipboardList,
      color: 'text-muted-foreground',
      bg: 'bg-muted',
    },
    {
      label: 'Pending Review',
      value: pending,
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100 dark:bg-yellow-900',
    },
    {
      label: 'Approved',
      value: approved,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-100 dark:bg-green-900',
    },
    {
      label: 'Rejected',
      value: rejected,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-100 dark:bg-red-900',
    },
  ];

  return (
    <div className={cn('grid grid-cols-2 gap-4 lg:grid-cols-4', className)}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex items-center gap-3">
            <div className={cn('rounded-lg p-2', stat.bg)}>
              <stat.icon className={cn('h-5 w-5', stat.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
