'use client';

import { useEffect, useState } from 'react';
import type { ReportFilters, DeviceManagementSummary } from '@/types/reports';
import { fetchDeviceManagementReport } from '@/lib/api/reports';
import { exportToCsv, formatPct } from '@/lib/export/csv';
import { MetricCard } from './metric-card';
import { DataTable } from './data-table';
import { DonutChart, COLORS } from './donut-chart';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Props { filters: ReportFilters }

export function DeviceManagementReport({ filters }: Props) {
  const [data, setData] = useState<DeviceManagementSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchDeviceManagementReport(filters)
      .then((d) => { setData(d); })
      .catch(() => { setData(null); })
      .finally(() => { setLoading(false); });
  }, [filters]);

  if (loading || !data) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const handleExport = () => {
    exportToCsv('device-management-report', ['Status', 'Count', 'Percentage'],
      data.rows.map((r) => [r.status, r.count, `${r.pct}%`])
    );
  };

  const deviceColors = ['bg-blue-500', 'bg-cyan-500', 'bg-green-500', 'bg-red-500', 'bg-orange-500'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Device Management Report</h2>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Devices" value={String(data.totalDevices)} />
        <MetricCard label="Active" value={String(data.active)} />
        <MetricCard label="Locked" value={String(data.locked)} />
        <MetricCard label="In Stock" value={String(data.inStock)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Lock Operations" value={String(data.lockOperations)} />
        <MetricCard label="Unlock Operations" value={String(data.unlockOperations)} />
        <MetricCard label="Avg Lock Duration" value={`${data.avgLockDurationHrs.toFixed(1)} hrs`} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DonutChart
          title="Device Status Distribution"
          data={data.rows.map((r, i) => ({ label: r.status, value: r.count, pct: r.pct, color: deviceColors[i] || COLORS[i] }))}
          centerValue={String(data.totalDevices)}
          centerLabel="Total"
        />
        <DataTable
          columns={[
            { key: 'status', header: 'Status' },
            { key: 'count', header: 'Count', align: 'right' },
            { key: 'pct', header: 'Percentage', align: 'right', render: (r) => formatPct((r as Record<string, number>).pct) },
          ]}
          data={data.rows as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
