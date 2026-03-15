'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@lynia/utils';
import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Lock,
  RefreshCw,
} from 'lucide-react';
import type { DashboardMetrics } from '@/types';

interface AlertsPanelProps {
  metrics: DashboardMetrics | undefined;
  fineractDiscrepancies?: number;
}

interface AlertItem {
  label: string;
  count: number;
  href: string;
  icon: typeof AlertTriangle;
  severity: 'critical' | 'warning' | 'info';
}

export function AlertsPanel({ metrics, fineractDiscrepancies }: AlertsPanelProps) {
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const alerts: AlertItem[] = [
    {
      label: 'Overdue Payments',
      count: metrics.overdue_payments,
      href: '/payments?status=overdue',
      icon: AlertTriangle,
      severity: 'critical',
    },
    {
      label: 'Pending KYC Reviews',
      count: metrics.pending_kyc,
      href: '/customers/kyc-review',
      icon: ClipboardCheck,
      severity: 'warning',
    },
    {
      label: 'Pending Loan Approvals',
      count: metrics.pending_approvals,
      href: '/loans?status=pending',
      icon: FileText,
      severity: 'warning',
    },
    {
      label: 'Devices to Lock',
      count: metrics.devices_locked,
      href: '/devices?lock_status=pending',
      icon: Lock,
      severity: 'info',
    },
  ];

  if (fineractDiscrepancies !== undefined && fineractDiscrepancies > 0) {
    alerts.push({
      label: 'Banking Discrepancies',
      count: fineractDiscrepancies,
      href: '/fineract/reconciliation',
      icon: RefreshCw,
      severity: 'warning',
    });
  }

  const activeAlerts = alerts.filter((a) => a.count > 0);

  const severityStyles = {
    critical: {
      bg: 'bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900',
      text: 'text-red-700 dark:text-red-300',
      badge: 'bg-red-500',
      icon: 'text-red-500',
    },
    warning: {
      bg: 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950 dark:hover:bg-yellow-900',
      text: 'text-yellow-800 dark:text-yellow-300',
      badge: 'bg-yellow-500',
      icon: 'text-yellow-500',
    },
    info: {
      bg: 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900',
      text: 'text-blue-700 dark:text-blue-300',
      badge: 'bg-blue-500',
      icon: 'text-blue-500',
    },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Today&apos;s Alerts
          {activeAlerts.length > 0 && (
            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
              {activeAlerts.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
            <span className="text-2xl">&#10003;</span>
            <p className="text-sm">All clear - no urgent items</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeAlerts.map((alert) => {
              const styles = severityStyles[alert.severity];
              const Icon = alert.icon;
              return (
                <Link
                  key={alert.label}
                  href={alert.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                    styles.bg
                  )}
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', styles.icon)} />
                  <span className={cn('flex-1 text-sm font-medium', styles.text)}>
                    {alert.label}
                  </span>
                  <span className={cn(
                    'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium text-white',
                    styles.badge
                  )}>
                    {alert.count}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
