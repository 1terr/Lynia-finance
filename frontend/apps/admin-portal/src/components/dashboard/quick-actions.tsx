'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { hasPermission } from '@/lib/permissions';
import type { AdminRole } from '@/types';
import {
  ClipboardCheck,
  FileText,
  Smartphone,
  CreditCard,
  Users,
  BarChart3,
} from 'lucide-react';

interface QuickActionsProps {
  role: AdminRole;
  pendingKyc: number;
  pendingApprovals: number;
}

export function QuickActions({ role, pendingKyc, pendingApprovals }: QuickActionsProps) {
  const actions = [
    {
      label: 'Review KYC',
      href: '/customers/kyc-review',
      icon: ClipboardCheck,
      badge: pendingKyc,
      permission: 'kyc:read' as const,
      color: 'text-purple-600',
      bg: 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950 dark:hover:bg-purple-900',
    },
    {
      label: 'Loan Approvals',
      href: '/loans?status=pending',
      icon: FileText,
      badge: pendingApprovals,
      permission: 'loans:approve' as const,
      color: 'text-blue-600',
      bg: 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900',
    },
    {
      label: 'Device Inventory',
      href: '/devices',
      icon: Smartphone,
      permission: 'devices:read' as const,
      color: 'text-green-600',
      bg: 'bg-green-50 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900',
    },
    {
      label: 'Payments',
      href: '/payments',
      icon: CreditCard,
      permission: 'payments:read' as const,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900',
    },
    {
      label: 'Customers',
      href: '/customers',
      icon: Users,
      permission: 'customers:read' as const,
      color: 'text-orange-600',
      bg: 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950 dark:hover:bg-orange-900',
    },
    {
      label: 'Reports',
      href: '/reports',
      icon: BarChart3,
      permission: 'reports:read' as const,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900',
    },
  ];

  const visibleActions = actions.filter(
    (a) => hasPermission(role, a.permission)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`relative flex flex-col items-center gap-2 rounded-lg p-4 transition-colors ${action.bg}`}
              >
                <Icon className={`h-6 w-6 ${action.color}`} />
                <span className="text-sm font-medium text-foreground">
                  {action.label}
                </span>
                {action.badge !== undefined && action.badge > 0 && (
                  <span className="absolute right-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                    {action.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
