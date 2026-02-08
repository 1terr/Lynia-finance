'use client';

import { useEffect, useState } from 'react';
import type { AuditLogEntry } from '@/types/settings';
import { fetchAuditLog } from '@/lib/api/settings';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ACTION_COLORS: Record<string, 'default' | 'destructive' | 'secondary' | 'success' | 'warning' | 'info'> = {
  create: 'success',
  update: 'info',
  delete: 'destructive',
  deactivate: 'warning',
  approve: 'success',
  reject: 'destructive',
  reconcile: 'info',
};

export function AuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceFilter, setResourceFilter] = useState<string>('all');

  useEffect(() => {
    fetchAuditLog().then((e) => { setEntries(e); setLoading(false); });
  }, []);

  const resources = ['all', ...new Set(entries.map((e) => e.resource))];
  const filtered = resourceFilter === 'all' ? entries : entries.filter((e) => e.resource === resourceFilter);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Audit Log</h3>
          <p className="text-sm text-muted-foreground">{entries.length} entries recorded</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter:</span>
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {resources.map((r) => (
              <option key={r} value={r}>{r === 'all' ? 'All Resources' : r.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Admin</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Resource</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Details</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">IP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-xs">{entry.admin_email}</td>
                <td className="px-4 py-3">
                  <Badge variant={ACTION_COLORS[entry.action] ?? 'secondary'}>{entry.action}</Badge>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="font-mono">{entry.resource}</span>
                  {entry.resource_id && (
                    <span className="ml-1 text-muted-foreground">({entry.resource_id})</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[300px] truncate">{entry.details}</td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{entry.ip_address}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No audit log entries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
