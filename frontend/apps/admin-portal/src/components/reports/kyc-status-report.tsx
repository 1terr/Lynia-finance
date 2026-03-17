'use client';

import { useEffect, useState } from 'react';
import type { ReportFilters, KycStatusSummary } from '@/types/reports';
import { fetchKycStatusReport } from '@/lib/api/reports';
import { exportToCsv, formatPct } from '@/lib/export/csv';
import { MetricCard } from './metric-card';
import { DataTable } from './data-table';
import { DonutChart, COLORS } from './donut-chart';
import { SimpleBarChart } from './bar-chart';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Props { filters: ReportFilters }

export function KycStatusReport({ filters }: Props) {
  const [data, setData] = useState<KycStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchKycStatusReport(filters)
      .then((d) => { setData(d); })
      .catch(() => { setData(null); })
      .finally(() => { setLoading(false); });
  }, [filters]);

  if (loading || !data) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const handleExport = () => {
    exportToCsv('kyc-status-report', ['Status', 'Count', 'Percentage', 'Avg Processing (min)'],
      data.rows.map((r) => [r.status, r.count, `${r.pct}%`, r.avgProcessingMins])
    );
  };

  const statusColors = ['bg-green-500', 'bg-red-500', 'bg-yellow-500'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">KYC Status Report</h2>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Total Submissions" value={String(data.totalSubmissions)} />
        <MetricCard label="Approved" value={String(data.approvedCount)} />
        <MetricCard label="Rejected" value={String(data.rejectedCount)} />
        <MetricCard label="Pending" value={String(data.pendingCount)} />
        <MetricCard label="Approval Rate" value={formatPct(data.approvalRate)} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DonutChart
          title="KYC Submission Status"
          data={data.rows.map((r, i) => ({ label: r.status, value: r.count, pct: r.pct, color: statusColors[i] || COLORS[i] }))}
          centerValue={String(data.totalSubmissions)}
          centerLabel="Total"
        />
        <SimpleBarChart
          title="Top Rejection Reasons"
          data={data.rejectionReasons.map((r) => ({ label: r.reason, value: r.count, color: 'bg-red-400' }))}
        />
      </div>
      <DataTable
        columns={[
          { key: 'status', header: 'Status' },
          { key: 'count', header: 'Count', align: 'right' },
          { key: 'pct', header: 'Percentage', align: 'right', render: (r) => formatPct((r as Record<string, number>).pct) },
          { key: 'avgProcessingMins', header: 'Avg Processing (min)', align: 'right' },
        ]}
        data={data.rows as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
