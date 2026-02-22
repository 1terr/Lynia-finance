'use client';

import { cn } from '@lynia/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  change?: number;
  subtitle?: string;
  className?: string;
}

export function MetricCard({ label, value, change, subtitle, className }: MetricCardProps) {
  const trend = change === undefined ? null : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow-sm', className)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <div className="mt-1 flex items-center gap-1">
        {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-green-600" />}
        {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
        {trend === 'flat' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
        {change !== undefined && (
          <span
            className={cn(
              'text-xs font-medium',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600',
              trend === 'flat' && 'text-muted-foreground'
            )}
          >
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}
