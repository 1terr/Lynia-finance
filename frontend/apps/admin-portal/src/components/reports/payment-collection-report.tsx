'use client';

import { useEffect, useState } from 'react';
import type { ReportFilters, PaymentCollectionSummary } from '@/types/reports';
import { fetchPaymentCollectionReport } from '@/lib/api/reports';
import { exportToCsv, formatCurrency, formatPct } from '@/lib/export/csv';
import { MetricCard } from './metric-card';
import { DataTable } from './data-table';
import { SimpleBarChart } from './bar-chart';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Props { filters: ReportFilters }

export function PaymentCollectionReport({ filters }: Props) {
  const [data, setData] = useState<PaymentCollectionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPaymentCollectionReport(filters).then((d) => { setData(d); setLoading(false); });
  }, [filters]);

  if (loading || !data) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const handleExport = () => {
    exportToCsv('payment-collection-report', ['Date', 'Expected', 'Actual', 'Collection Rate', 'Txns', 'Failed'],
      data.rows.map((r) => [r.date, r.expected, r.actual, `${r.collectionRate}%`, r.txnCount, r.failedCount])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Payment Collection Report</h2>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Expected" value={formatCurrency(data.totalExpected)} />
        <MetricCard label="Collected" value={formatCurrency(data.totalCollected)} />
        <MetricCard label="Collection Rate" value={formatPct(data.collectionRate)} />
        <MetricCard label="Transactions" value={String(data.totalTransactions)} />
        <MetricCard label="Failed" value={String(data.failedTransactions)} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SimpleBarChart
          title="Collections by Payment Method"
          data={data.byMethod.map((m) => ({ label: `${m.method} (${m.count} txns)`, value: m.amount }))}
          valueFormatter={formatCurrency}
        />
        <DataTable
          columns={[
            { key: 'date', header: 'Week' },
            { key: 'expected', header: 'Expected', align: 'right', render: (r) => formatCurrency((r as Record<string, number>).expected) },
            { key: 'actual', header: 'Actual', align: 'right', render: (r) => formatCurrency((r as Record<string, number>).actual) },
            { key: 'collectionRate', header: 'Rate', align: 'right', render: (r) => formatPct((r as Record<string, number>).collectionRate) },
            { key: 'failedCount', header: 'Failed', align: 'right' },
          ]}
          data={data.rows as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
