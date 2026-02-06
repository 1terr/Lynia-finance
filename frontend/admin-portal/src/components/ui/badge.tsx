import { cn } from '@/lib/utils';
import { statusColor } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'status';
  status?: string;
}

export function Badge({ className, variant = 'default', status, children, ...props }: BadgeProps) {
  const colorClass = variant === 'status' && status ? statusColor(status) : 'bg-gray-100 text-gray-800';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorClass,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
