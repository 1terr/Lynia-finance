'use client';

import { useEffect, useState } from 'react';
import type { ReportFilters, DefaultRateSummary } from '@/types/reports';
import { fetchDefaultRateReport } from '@/lib/api/reports';
import { exportToCsv, formatCurrency, formatPct } from '@/lib/export/csv';
import { MetricCard } from './metric-card';
import { DataTable } from './data-table';
import { SimpleBarChart } from './bar-chart';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Props { filters: ReportFilters }

export function DefaultRateReport({ filters }: Props) {
  const [data, setData] = useState<DefaultRateSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchDefaultRateReport(filters)
      .then((d) => { setData(d); })
      .catch(() => { setData(null); })
      .finally(() => { setLoading(false); });
  }, [filters]);

  if (loading || !data) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const handleExport = () => {
    exportToCsv('default-rate-report', ['Bucket', 'Loans', 'Outstanding', 'PAR %'],
      data.rows.map((r) => [r.bucket, r.loanCount, r.outstandingBalance, `${r.parPct}%`])
    );
  };

  const barColors = ['bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-400', 'bg-red-600'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Default Rate / PAR Report</h2>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="PAR 30" value={formatPct(data.par30)} />
        <MetricCard label="PAR 60" value={formatPct(data.par60)} />
        <MetricCard label="PAR 90" value={formatPct(data.par90)} />
        <MetricCard label="Default Rate" value={formatPct(data.defaultRate)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Recovery Rate" value={formatPct(data.recoveryRate)} />
        <MetricCard label="Write-Off Rate" value={formatPct(data.writeOffRate)} />
        <MetricCard label="Total Outstanding" value={formatCurrency(data.totalOutstanding)} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SimpleBarChart
          title="Portfolio at Risk by Aging Bucket"
          data={data.rows.map((r, i) => ({ label: r.bucket, value: r.outstandingBalance, color: barColors[i] }))}
          valueFormatter={formatCurrency}
        />
        <DataTable
          columns={[
            { key: 'bucket', header: 'Bucket' },
            { key: 'loanCount', header: 'Loans', align: 'right' },
            { key: 'outstandingBalance', header: 'Outstanding', align: 'right', render: (r) => formatCurrency((r as Record<string, number>).outstandingBalance) },
            { key: 'parPct', header: 'PAR %', align: 'right', render: (r) => formatPct((r as Record<string, number>).parPct) },
          ]}
          data={data.rows as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
