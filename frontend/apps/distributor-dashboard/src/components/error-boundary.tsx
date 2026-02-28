'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-8 shadow-sm">
          <div className="rounded-full bg-red-100 p-3 mb-4 dark:bg-red-900/20">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Something went wrong</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
            {this.state.error?.message || 'An unexpected error occurred while rendering this component.'}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            <RefreshCw className="h-4 w-4 mr-1.5" />Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
