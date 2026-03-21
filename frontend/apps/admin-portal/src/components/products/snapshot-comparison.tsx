'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { formatCurrency, formatDate } from '@lynia/utils';
import { History, ChevronLeft, ChevronRight, Eye, AlertTriangle, Check } from 'lucide-react';
import {
  getProductSnapshots,
  getSnapshotDiff,
  type ProductSnapshot,
  type SnapshotDiffResult,
} from '@/lib/api/product-snapshots';

interface SnapshotComparisonProps {
  productId: string;
}

export function SnapshotComparison({ productId }: SnapshotComparisonProps) {
  const [page, setPage] = useState(1);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['product-snapshots', productId, page],
    queryFn: () => getProductSnapshots(productId, page, 10),
  });

  const snapshots = data?.data || [];
  const totalPages = data?.total_pages || 1;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (snapshots.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <History className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No snapshots yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Snapshots are created automatically when loans are approved under this product.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Product Term Snapshots
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Each snapshot records the product terms at the time a loan was approved.
            Compare snapshots against current terms to see what has changed.
          </p>

          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Loan</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Rate</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Term</th>
                  <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snap) => (
                  <tr
                    key={snap.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {snap.loan_number || snap.loan_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5">
                      {snap.customer_name || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatDate(snap.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {snap.interest_rate_at_approval != null
                        ? `${snap.interest_rate_at_approval}%`
                        : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {snap.term_months_at_approval != null
                        ? `${snap.term_months_at_approval}mo`
                        : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLoanId(snap.loan_id)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> View Diff
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({data?.total} snapshots)
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diff Modal */}
      {selectedLoanId && (
        <SnapshotDiffModal
          loanId={selectedLoanId}
          onClose={() => setSelectedLoanId(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Diff Modal
// ---------------------------------------------------------------------------

function SnapshotDiffModal({
  loanId,
  onClose,
}: {
  loanId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['snapshot-diff', loanId],
    queryFn: () => getSnapshotDiff(loanId),
  });

  return (
    <Modal open onClose={onClose} title="Snapshot vs Current Product" size="lg">
      {isLoading ? (
        <div className="space-y-2 py-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-red-600">
          Failed to load snapshot comparison. The snapshot may not exist for this loan.
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Snapshot from {formatDate(data.snapshot_created_at)}
            </span>
            {data.changed_count > 0 ? (
              <Badge variant="yellow">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {data.changed_count} field{data.changed_count !== 1 ? 's' : ''} changed
              </Badge>
            ) : (
              <Badge variant="green">
                <Check className="mr-1 h-3 w-3" />
                No changes
              </Badge>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border max-h-[60vh] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Field</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">At Approval</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Current</th>
                  <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.diff.map((row) => (
                  <tr
                    key={row.field}
                    className={`border-b last:border-0 transition-colors ${
                      row.changed ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''
                    }`}
                  >
                    <td className="px-4 py-2 font-medium">{row.label}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {formatFieldValue(row.at_approval)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {formatFieldValue(row.current)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {row.changed ? (
                        <Badge variant="yellow" className="text-xs">Changed</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unchanged</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
