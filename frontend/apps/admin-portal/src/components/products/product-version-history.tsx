'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProductVersions, type ProductVersion } from '@/lib/api/products';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Clock, Plus, RefreshCw, Trash2, RotateCcw } from 'lucide-react';

const CHANGE_TYPE_CONFIG: Record<string, { label: string; variant: 'green' | 'blue' | 'red' | 'gray'; icon: typeof Plus }> = {
  create: { label: 'Created', variant: 'green', icon: Plus },
  update: { label: 'Updated', variant: 'blue', icon: RefreshCw },
  deactivate: { label: 'Deactivated', variant: 'red', icon: Trash2 },
  reactivate: { label: 'Reactivated', variant: 'green', icon: RotateCcw },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  }
  if (diffHours < 24) {
    const hrs = Math.floor(diffHours);
    return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  }
  if (diffDays < 30) {
    const days = Math.floor(diffDays);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function countChanges(prev: Record<string, unknown> | null, next: Record<string, unknown>): number {
  if (!prev) return Object.keys(next).length;
  let count = 0;
  for (const key of Object.keys(next)) {
    if (key === 'updated_at' || key === 'created_at') continue;
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) count++;
  }
  return count;
}

function formatFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Usd/g, 'USD')
    .replace(/Id/g, 'ID')
    .replace(/Gl /g, 'GL ')
    .replace(/Api /g, 'API ');
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function VersionDiff({ version }: { version: ProductVersion }) {
  const prev = version.previous_values;
  const next = version.new_values;
  const skipKeys = new Set(['updated_at', 'created_at', 'fineract_synced_at']);

  const changedKeys = Object.keys(next).filter((key) => {
    if (skipKeys.has(key)) return false;
    if (!prev) return true;
    return JSON.stringify(prev[key]) !== JSON.stringify(next[key]);
  });

  if (changedKeys.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No field changes recorded.</p>;
  }

  return (
    <div className="mt-2 space-y-1">
      {changedKeys.map((key) => (
        <div key={key} className="flex items-start gap-2 text-xs rounded bg-muted/50 px-2 py-1">
          <span className="font-medium text-foreground min-w-[140px] shrink-0">{formatFieldName(key)}</span>
          {prev && prev[key] !== undefined ? (
            <>
              <span className="text-red-600 line-through truncate max-w-[200px]" title={formatFieldValue(prev[key])}>
                {formatFieldValue(prev[key])}
              </span>
              <span className="text-muted-foreground">-&gt;</span>
              <span className="text-green-600 truncate max-w-[200px]" title={formatFieldValue(next[key])}>
                {formatFieldValue(next[key])}
              </span>
            </>
          ) : (
            <span className="text-green-600 truncate max-w-[200px]" title={formatFieldValue(next[key])}>
              {formatFieldValue(next[key])}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

interface ProductVersionHistoryProps {
  productId: string;
}

export function ProductVersionHistory({ productId }: ProductVersionHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['product-versions', productId],
    queryFn: () => getProductVersions(productId),
  });

  const versions = data?.data || [];

  if (isLoading) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Change History</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </Card>
    );
  }

  if (versions.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Change History</h2>
        <div className="rounded-lg border-2 border-dashed border-border py-8 text-center">
          <Clock className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p className="text-sm text-muted-foreground">No version history available.</p>
          <p className="text-xs text-muted-foreground mt-1">Changes will be tracked going forward.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Change History
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          ({versions.length} version{versions.length !== 1 ? 's' : ''})
        </span>
      </h2>
      <div className="space-y-2">
        {versions.map((version) => {
          const config = CHANGE_TYPE_CONFIG[version.change_type] || CHANGE_TYPE_CONFIG.update;
          const Icon = config.icon;
          const isExpanded = expandedId === version.id;
          const changeCount = countChanges(version.previous_values, version.new_values);

          return (
            <div key={version.id} className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : version.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      v{version.version_number}
                    </span>
                    <Badge variant={config.variant}>{config.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {changeCount} field{changeCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {version.changed_by} -- {formatRelativeTime(version.changed_at)}
                    {version.change_reason && (
                      <span className="ml-2 italic">&quot;{version.change_reason}&quot;</span>
                    )}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
              {isExpanded && (
                <div className="px-4 pb-3 border-t border-border pt-2">
                  <VersionDiff version={version} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
