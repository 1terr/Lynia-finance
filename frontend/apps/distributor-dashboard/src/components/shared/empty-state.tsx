'use client';

import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-8 shadow-sm text-center">
      <div className="rounded-full bg-muted p-3 mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {message && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">{message}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
