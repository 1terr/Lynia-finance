'use client';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon: Icon,
  iconColor = 'text-brand-600',
  iconBg = 'bg-brand-50',
}: MetricCardProps) {
  const TrendIcon =
    change === undefined || change === 0
      ? Minus
      : change > 0
        ? TrendingUp
        : TrendingDown;

  const trendColor =
    change === undefined || change === 0
      ? 'text-gray-500'
      : change > 0
        ? 'text-green-600'
        : 'text-red-600';

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className={cn('flex-shrink-0 rounded-lg p-2.5', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
      </div>

      {change !== undefined && (
        <div className="mt-3 flex items-center gap-1">
          <TrendIcon className={cn('h-4 w-4', trendColor)} />
          <span className={cn('text-sm font-medium', trendColor)}>
            {change > 0 ? '+' : ''}
            {change.toFixed(1)}%
          </span>
          {changeLabel && (
            <span className="text-sm text-gray-500">
              {changeLabel}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
