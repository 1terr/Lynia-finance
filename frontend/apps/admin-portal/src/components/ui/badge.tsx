'use client';

import { cn } from '@lynia/utils';

type BadgeVariant = 'default' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' | 'status' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'outline' | 'gold';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  status?: string;
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  destructive: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  outline: 'border border-border text-foreground bg-transparent',
  gold: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  unlocked: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  pending_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  pending_approval: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  processing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  in_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  submitted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  in_stock: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  reserved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_transit: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  requested: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  defaulted: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  locked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  expired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  written_off: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  refunded: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  suspended: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  sold: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  disbursed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  returned: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  repossessed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  damaged: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  lost: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  emergency_unlocked: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  add: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  remove: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  damage: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  write_off: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  found: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  audit_correction: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  received: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  handover: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  pending_receipt: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  disputed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  return_requested: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  return_approved: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

function getStyle(variant: BadgeVariant, status?: string): string {
  if (variant === 'status' && status) {
    return statusStyles[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
  return variantStyles[variant] || variantStyles.default;
}

export function Badge({ children, variant = 'default', status, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        getStyle(variant, status),
        className
      )}
    >
      {children}
    </span>
  );
}
