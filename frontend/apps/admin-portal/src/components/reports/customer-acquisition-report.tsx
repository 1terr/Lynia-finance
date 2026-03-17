'use client';

import { useEffect, useState } from 'react';
import type { ReportFilters, CustomerAcquisitionSummary } from '@/types/reports';
import { fetchCustomerAcquisitionReport } from '@/lib/api/reports';
import { exportToCsv, formatCurrency, formatPct } from '@/lib/export/csv';
import { MetricCard } from './metric-card';
import { DataTable } from './data-table';
import { SimpleBarChart } from './bar-chart';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { cn } from '@lynia/utils';

interface Props { filters: ReportFilters }

export function CustomerAcquisitionReport({ filters }: Props) {
  const [data, setData] = useState<CustomerAcquisitionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCustomerAcquisitionReport(filters)
      .then((d) => { setData(d); })
      .catch(() => { setData(null); })
      .finally(() => { setLoading(false); });
  }, [filters]);

  if (loading || !data) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const handleExport = () => {
    exportToCsv('customer-acquisition-report', ['Stage', 'Count', 'Conversion Rate'],
      data.funnel.map((r) => [r.stage, r.count, `${r.conversionRate}%`])
    );
  };

  const funnelColors = ['bg-blue-600', 'bg-blue-500', 'bg-blue-400', 'bg-cyan-500', 'bg-green-500', 'bg-green-600'];
  const maxCount = data.funnel[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Customer Acquisition Report</h2>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="New Customers" value={String(data.newCustomers)} />
        <MetricCard label="Completion Rate" value={formatPct(data.completionRate)} />
        <MetricCard label="Avg Onboarding" value={`${data.avgOnboardingDays.toFixed(1)} days`} />
        <MetricCard label="Cost per Acquisition" value={formatCurrency(data.costPerAcquisition)} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Funnel visualization */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Acquisition Funnel</h3>
          <div className="space-y-2">
            {data.funnel.map((step, i) => {
              const widthPct = (step.count / maxCount) * 100;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{step.stage}</span>
                    <span className="font-medium">{step.count} <span className="text-xs text-muted-foreground">({step.conversionRate}%)</span></span>
                  </div>
                  <div className="h-6 w-full rounded bg-muted overflow-hidden">
                    <div
                      className={cn('h-6 rounded transition-all duration-500 flex items-center justify-center', funnelColors[i] ?? 'bg-primary')}
                      style={{ width: `${widthPct}%` }}
                    >
                      {widthPct > 20 && <span className="text-[10px] font-medium text-white">{step.count}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <SimpleBarChart
          title="Customers by Source"
          data={data.bySource.map((s) => ({ label: `${s.source} (${s.pct}%)`, value: s.count }))}
        />
      </div>
      <DataTable
        columns={[
          { key: 'stage', header: 'Funnel Stage' },
          { key: 'count', header: 'Count', align: 'right' },
          { key: 'conversionRate', header: 'Conversion Rate', align: 'right', render: (r) => formatPct((r as Record<string, number>).conversionRate) },
        ]}
        data={data.funnel as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
