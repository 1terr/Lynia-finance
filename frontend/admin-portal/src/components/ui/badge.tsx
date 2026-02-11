import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        warning: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        info: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        red: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        yellow: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        blue: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        green: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        gray: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const STATUS_VARIANT_MAP: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
  active: 'success',
  approved: 'success',
  verified: 'success',
  completed: 'success',
  paid: 'success',
  paid_off: 'success',
  disbursed: 'info',
  pending: 'warning',
  pending_review: 'warning',
  pending_approval: 'warning',
  submitted: 'warning',
  in_review: 'warning',
  in_stock: 'info',
  allocated: 'info',
  rejected: 'destructive',
  failed: 'destructive',
  blocked: 'destructive',
  defaulted: 'destructive',
  written_off: 'destructive',
  locked: 'red',
  overdue: 'red',
  inactive: 'gray',
  returned: 'gray',
  damaged: 'gray',
  refunded: 'gray',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  status?: string;
}

export function Badge({ className, variant, status, ...props }: BadgeProps) {
  const resolvedVariant = variant === 'status' || (variant === undefined && status)
    ? (STATUS_VARIANT_MAP[status || ''] || 'secondary')
    : variant;
  return <div className={cn(badgeVariants({ variant: resolvedVariant }), className)} {...props} />;
}
