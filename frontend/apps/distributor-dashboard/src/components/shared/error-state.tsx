'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We couldn\u2019t load this data. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-8 shadow-sm text-center">
      <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3 mb-4">
        <AlertTriangle className="h-6 w-6 text-red-600" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Try Again
        </Button>
      )}
    </div>
  );
}
