'use client';

import { useEffect, useState } from 'react';
import type { ReportFilters, LoanDisbursementSummary } from '@/types/reports';
import { fetchLoanDisbursementReport } from '@/lib/api/reports';
import { exportToCsv, formatCurrency, formatPct } from '@/lib/export/csv';
import { MetricCard } from './metric-card';
import { DataTable } from './data-table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Props { filters: ReportFilters }

export function LoanDisbursementReport({ filters }: Props) {
  const [data, setData] = useState<LoanDisbursementSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchLoanDisbursementReport(filters)
      .then((d) => { setData(d); })
      .catch(() => { setData(null); })
      .finally(() => { setLoading(false); });
  }, [filters]);

  if (loading || !data) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const handleExport = () => {
    exportToCsv('loan-disbursement-report', ['Date', 'Count', 'Total Value', 'Avg Amount', 'Approval Rate', 'Product'],
      data.rows.map((r) => [r.date, r.count, r.totalValue, r.avgAmount, `${r.approvalRate}%`, r.product])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Loan Disbursement Report</h2>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Total Disbursed" value={String(data.totalDisbursed)} change={data.growthPct} />
        <MetricCard label="Total Value" value={formatCurrency(data.totalValue)} />
        <MetricCard label="Avg Loan Size" value={formatCurrency(data.avgLoanSize)} />
        <MetricCard label="Approval Rate" value={formatPct(data.approvalRate)} />
        <MetricCard label="Growth" value={formatPct(data.growthPct)} change={data.growthPct} />
      </div>
      <DataTable
        columns={[
          { key: 'date', header: 'Week' },
          { key: 'count', header: 'Loans', align: 'right' },
          { key: 'totalValue', header: 'Value', align: 'right', render: (r) => formatCurrency((r as Record<string, number>).totalValue) },
          { key: 'avgAmount', header: 'Avg Amount', align: 'right', render: (r) => formatCurrency((r as Record<string, number>).avgAmount) },
          { key: 'approvalRate', header: 'Approval Rate', align: 'right', render: (r) => formatPct((r as Record<string, number>).approvalRate) },
          { key: 'product', header: 'Product' },
        ]}
        data={data.rows as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
