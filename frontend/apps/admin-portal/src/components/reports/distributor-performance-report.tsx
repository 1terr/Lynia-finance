'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DateRange } from '@/types/reports';
import { DateRangeFilter, getPresetDates } from '@/components/reports/date-range-filter';
import { MetricCard } from './metric-card';
import { DataTable } from './data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { getDistributorPerformance } from '@/lib/api/reports';
import { exportToCsv, formatCurrency, formatNumber } from '@/lib/export/csv';

type SortBy = 'handovers' | 'commissions';

export function DistributorPerformanceReport() {
  const defaultDates = getPresetDates('30d');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: defaultDates.from,
    to: defaultDates.to,
    preset: '30d',
  });
  const [sortBy, setSortBy] = useState<SortBy>('handovers');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      date_from: dateRange.from,
      date_to: dateRange.to,
      sort_by: sortBy,
      page,
      limit: 25,
    }),
    [dateRange, sortBy, page]
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['distributor-performance', params],
    queryFn: () => getDistributorPerformance(params),
  });

  const handleExport = () => {
    if (!data) return;
    exportToCsv(
      'distributor-performance-rankings',
      ['Rank', 'Business Name', 'Contact Person', 'Location', 'Status', 'Handovers', 'Total Commission'],
      data.rankings.map((r) => [
        r.rank,
        r.business_name,
        r.contact_person,
        r.location,
        r.status,
        r.handover_count,
        r.total_commission,
      ])
    );
  };

  const handleSortChange = (newSort: SortBy) => {
    setSortBy(newSort);
    setPage(1);
  };

  if (isError) {
    return (
      <div className="flex justify-center py-12 text-destructive">
        Failed to load distributor performance data. Please try again.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const { summary, rankings, pagination } = data;

  return (
    <div className="space-y-6">
      {/* Header with date filter and export */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-lg font-semibold">Distributor Performance Rankings</h2>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeFilter value={dateRange} onChange={(range) => { setDateRange(range); setPage(1); }} />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1.5" />Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Distributors" value={formatNumber(summary.total_distributors)} />
        <MetricCard label="Total Handovers" value={formatNumber(summary.total_handovers)} />
        <MetricCard label="Total Commissions" value={formatCurrency(summary.total_commissions)} />
        <MetricCard label="Avg Handovers / Distributor" value={String(summary.avg_handovers_per_distributor)} />
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <div className="flex rounded-lg border bg-muted/50 p-0.5">
          <button
            onClick={() => handleSortChange('handovers')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === 'handovers'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Handovers
          </button>
          <button
            onClick={() => handleSortChange('commissions')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === 'commissions'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Commissions
          </button>
        </div>
      </div>

      {/* Rankings Table */}
      <DataTable
        columns={[
          { key: 'rank', header: '#', align: 'center', className: 'w-12' },
          { key: 'business_name', header: 'Distributor' },
          { key: 'contact_person', header: 'Contact Person' },
          { key: 'location', header: 'Location' },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <Badge variant="status" status={String((row as Record<string, unknown>).status)}>
                {String((row as Record<string, unknown>).status).replace(/_/g, ' ')}
              </Badge>
            ),
          },
          {
            key: 'handover_count',
            header: 'Handovers',
            align: 'right',
            render: (row) => formatNumber((row as Record<string, number>).handover_count),
          },
          {
            key: 'total_commission',
            header: 'Commission',
            align: 'right',
            render: (row) => formatCurrency((row as Record<string, number>).total_commission),
          },
        ]}
        data={rankings as unknown as Record<string, unknown>[]}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} distributors)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
