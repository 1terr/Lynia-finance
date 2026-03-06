'use client';

import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@lynia/utils';
import { getSLAStatus } from '@lynia/utils';

interface SLAIndicatorProps {
  deadline: string;
  className?: string;
  compact?: boolean;
}

const colorStyles = {
  red: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    icon: 'text-red-500',
    border: 'border-red-200',
    progress: 'bg-red-500',
  },
  yellow: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    icon: 'text-yellow-500',
    border: 'border-yellow-200',
    progress: 'bg-yellow-500',
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    icon: 'text-green-500',
    border: 'border-green-200',
    progress: 'bg-green-500',
  },
  gray: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    icon: 'text-gray-500',
    border: 'border-gray-200',
    progress: 'bg-gray-500',
  },
};

export function SLAIndicator({ deadline, className, compact = false }: SLAIndicatorProps) {
  const sla = getSLAStatus(deadline);
  const styles = colorStyles[sla.color];

  // Calculate progress bar (24 hours total SLA)
  const totalHours = 24;
  const elapsed = totalHours - Math.max(0, sla.hoursRemaining);
  const progressPercent = Math.min(100, (elapsed / totalHours) * 100);

  // Critical breach: >48 hours past the SLA deadline
  const hoursOverdue = sla.isExpired
    ? (Date.now() - new Date(deadline).getTime()) / (1000 * 60 * 60)
    : 0;
  const isCriticalBreach = hoursOverdue > 48;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        {sla.isExpired ? (
          <AlertTriangle
            className={cn(
              'h-3.5 w-3.5',
              styles.icon,
              isCriticalBreach && 'animate-pulse'
            )}
          />
        ) : (
          <Clock className={cn('h-3.5 w-3.5', styles.icon)} />
        )}
        <span
          className={cn(
            'text-xs font-medium',
            styles.text,
            isCriticalBreach && 'animate-pulse'
          )}
        >
          {sla.label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        styles.bg,
        styles.border,
        isCriticalBreach && 'border-red-400 ring-1 ring-red-300',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {sla.isExpired ? (
            <AlertTriangle
              className={cn(
                'h-4 w-4',
                styles.icon,
                isCriticalBreach && 'animate-pulse'
              )}
            />
          ) : (
            <Clock className={cn('h-4 w-4', styles.icon)} />
          )}
          <span
            className={cn(
              'text-sm font-medium',
              styles.text,
              isCriticalBreach && 'animate-pulse font-bold'
            )}
          >
            SLA: {sla.label}
          </span>
          {isCriticalBreach && (
            <span className="ml-1 inline-flex items-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white animate-pulse">
              CRITICAL
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div
          className={cn(
            'h-1.5 rounded-full transition-all',
            styles.progress,
            isCriticalBreach && 'animate-pulse'
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
