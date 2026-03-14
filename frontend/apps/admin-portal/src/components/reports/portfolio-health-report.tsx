'use client';

import { useEffect, useState } from 'react';
import type { ReportFilters, PortfolioHealthSummary } from '@/types/reports';
import { fetchPortfolioHealthReport } from '@/lib/api/reports';
import { exportToCsv, formatCurrency, formatPct } from '@/lib/export/csv';
import { MetricCard } from './metric-card';
import { DataTable } from './data-table';
import { DonutChart, COLORS } from './donut-chart';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Props { filters: ReportFilters }

export function PortfolioHealthReport({ filters }: Props) {
  const [data, setData] = useState<PortfolioHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPortfolioHealthReport(filters)
      .then((d) => { setData(d); })
      .catch(() => { /* data stays null — loading spinner replaced by null guard */ })
      .finally(() => { setLoading(false); });
  }, [filters]);

  if (loading || !data) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const handleExport = () => {
    const rows: (string | number)[][] = [];
    rows.push(['--- By Status ---', '', '']);
    data.byStatus.forEach((r) => rows.push([r.category, r.value, `${r.pct}%`]));
    rows.push(['--- By Tier ---', '', '']);
    data.byTier.forEach((r) => rows.push([r.category, r.value, `${r.pct}%`]));
    rows.push(['--- By Age ---', '', '']);
    data.byAge.forEach((r) => rows.push([r.category, r.value, `${r.pct}%`]));
    exportToCsv('portfolio-health-report', ['Category', 'Value', 'Percentage'], rows);
  };

  const statusColors = ['bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-400', 'bg-red-600'];
  const tierColors = ['bg-blue-400', 'bg-blue-500', 'bg-blue-700'];
  const ageColors = ['bg-cyan-400', 'bg-cyan-500', 'bg-teal-500', 'bg-teal-700'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Portfolio Health Report</h2>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Total Outstanding" value={formatCurrency(data.totalOutstanding)} />
        <MetricCard label="Total Disbursed" value={formatCurrency(data.totalDisbursed)} />
        <MetricCard label="Collection Efficiency" value={formatPct(data.collectionEfficiency)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="PAR 30" value={formatPct(data.par30)} />
        <MetricCard label="PAR 60" value={formatPct(data.par60)} />
        <MetricCard label="PAR 90" value={formatPct(data.par90)} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DonutChart
          title="By Status"
          data={data.byStatus.map((r, i) => ({ label: r.category, value: r.value, pct: r.pct, color: statusColors[i] || COLORS[i] }))}
          centerValue={formatCurrency(data.totalOutstanding)}
          centerLabel="Outstanding"
        />
        <DonutChart
          title="By Loan Tier"
          data={data.byTier.map((r, i) => ({ label: r.category, value: r.value, pct: r.pct, color: tierColors[i] || COLORS[i] }))}
          centerValue={String(data.byTier.length)}
          centerLabel="Tiers"
        />
        <DonutChart
          title="By Loan Age"
          data={data.byAge.map((r, i) => ({ label: r.category, value: r.value, pct: r.pct, color: ageColors[i] || COLORS[i] }))}
          centerValue={formatCurrency(data.totalOutstanding)}
          centerLabel="Outstanding"
        />
      </div>
      <DataTable
        columns={[
          { key: 'category', header: 'Status' },
          { key: 'value', header: 'Value', align: 'right', render: (r) => formatCurrency((r as Record<string, number>).value) },
          { key: 'pct', header: 'Percentage', align: 'right', render: (r) => formatPct((r as Record<string, number>).pct) },
        ]}
        data={data.byStatus as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
