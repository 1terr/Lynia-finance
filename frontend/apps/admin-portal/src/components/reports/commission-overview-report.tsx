'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DateRange } from '@/types/reports';
import { DateRangeFilter, getPresetDates } from '@/components/reports/date-range-filter';
import { MetricCard } from './metric-card';
import { DataTable } from './data-table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { getCommissionOverview } from '@/lib/api/reports';
import { exportToCsv, formatCurrency, formatNumber } from '@/lib/export/csv';

export function CommissionOverviewReport() {
  const defaultDates = getPresetDates('30d');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: defaultDates.from,
    to: defaultDates.to,
    preset: '30d',
  });
  const [page, setPage] = useState(1);
  const limit = 25;

  const queryParams = useMemo(() => ({
    date_from: dateRange.from,
    date_to: dateRange.to,
    page,
    limit,
  }), [dateRange, page]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['commission-overview', queryParams],
    queryFn: () => getCommissionOverview(queryParams),
  });

  const handleExport = () => {
    if (!data) return;
    exportToCsv(
      'commission-overview-report',
      ['Distributor', 'Location', 'Handovers', 'Total Earned', 'Total Paid', 'Total Pending'],
      data.distributors.map((d) => [
        d.business_name,
        d.location,
        d.handover_count,
        d.total_earned,
        d.total_paid,
        d.total_pending,
      ])
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        Failed to load commission data. Please try again.
      </div>
    );
  }

  const { summary, distributors, pagination } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Commission Overview</h2>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeFilter value={dateRange} onChange={(range) => { setDateRange(range); setPage(1); }} />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1.5" />Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Earned" value={formatCurrency(summary.total_earned)} />
        <MetricCard label="Total Paid" value={formatCurrency(summary.total_paid)} />
        <MetricCard label="Total Pending" value={formatCurrency(summary.total_pending)} />
        <MetricCard
          label="Distributors"
          value={formatNumber(summary.distributor_count)}
          subtitle={`${formatNumber(summary.total_handovers)} handovers`}
        />
      </div>

      {/* Per-Distributor Table */}
      <DataTable
        columns={[
          { key: 'business_name', header: 'Distributor' },
          { key: 'location', header: 'Location' },
          {
            key: 'handover_count',
            header: 'Handovers',
            align: 'right',
            render: (r) => formatNumber((r as Record<string, number>).handover_count),
          },
          {
            key: 'total_earned',
            header: 'Total Earned',
            align: 'right',
            render: (r) => formatCurrency((r as Record<string, number>).total_earned),
          },
          {
            key: 'total_paid',
            header: 'Total Paid',
            align: 'right',
            render: (r) => formatCurrency((r as Record<string, number>).total_paid),
          },
          {
            key: 'total_pending',
            header: 'Pending',
            align: 'right',
            render: (r) => {
              const pending = (r as Record<string, number>).total_pending;
              return (
                <span className={pending > 0 ? 'text-amber-600 font-medium' : ''}>
                  {formatCurrency(pending)}
                </span>
              );
            },
          },
        ]}
        data={distributors as unknown as Record<string, unknown>[]}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(pagination.page - 1) * pagination.limit + 1}
            {' '}-{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)}
            {' '}of {pagination.total}
          </span>
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
