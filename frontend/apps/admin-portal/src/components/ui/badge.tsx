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
  default: 'bg-gray-100 text-gray-800',
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  gray: 'bg-gray-100 text-gray-600',
  secondary: 'bg-gray-100 text-gray-800',
  destructive: 'bg-red-100 text-red-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
  outline: 'border border-gray-300 text-gray-700 bg-transparent',
  gold: 'bg-amber-100 text-amber-800',
};

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  confirmed: 'bg-green-100 text-green-800',
  approved: 'bg-green-100 text-green-800',
  success: 'bg-green-100 text-green-800',
  unlocked: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  in_stock: 'bg-blue-100 text-blue-800',
  assigned: 'bg-blue-100 text-blue-800',
  reserved: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-blue-100 text-blue-800',
  requested: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
  defaulted: 'bg-red-100 text-red-800',
  locked: 'bg-red-100 text-red-800',
  blocked: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  overdue: 'bg-red-100 text-red-800',
  expired: 'bg-red-100 text-red-800',
  written_off: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-600',
  inactive: 'bg-gray-100 text-gray-600',
  suspended: 'bg-gray-100 text-gray-600',
  draft: 'bg-gray-100 text-gray-600',
  sold: 'bg-purple-100 text-purple-800',
  disbursed: 'bg-purple-100 text-purple-800',
  returned: 'bg-orange-100 text-orange-800',
  repossessed: 'bg-orange-100 text-orange-800',
  damaged: 'bg-orange-100 text-orange-800',
  lost: 'bg-orange-100 text-orange-800',
  emergency_unlocked: 'bg-orange-100 text-orange-800',
  paid: 'bg-green-100 text-green-800',
  add: 'bg-green-100 text-green-800',
  remove: 'bg-red-100 text-red-800',
  damage: 'bg-orange-100 text-orange-800',
  write_off: 'bg-red-100 text-red-800',
  found: 'bg-blue-100 text-blue-800',
  audit_correction: 'bg-yellow-100 text-yellow-800',
  received: 'bg-green-100 text-green-800',
  handover: 'bg-blue-100 text-blue-800',
};

function getStyle(variant: BadgeVariant, status?: string): string {
  if (variant === 'status' && status) {
    return statusStyles[status] || 'bg-gray-100 text-gray-800';
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
