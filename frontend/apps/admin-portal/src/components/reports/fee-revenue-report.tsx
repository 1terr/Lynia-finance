'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MetricCard } from '@/components/reports/metric-card';
import { formatCurrency } from '@lynia/utils';
import { useChartTheme } from '@/hooks/use-chart-theme';
import { BarChart3 } from 'lucide-react';
import type { DateRange } from '@/types/reports';
import { DateRangeFilter, getPresetDates } from '@/components/reports/date-range-filter';
import { fetchFeeRevenueReport, type FeeRevenueData } from '@/lib/api/fee-revenue';

export function FeeRevenueReport() {
  const [dateRange, setDateRange] = useState<DateRange>({ ...getPresetDates('30d'), preset: '30d' });
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'fee-revenue', dateRange.from, dateRange.to],
    queryFn: () =>
      fetchFeeRevenueReport(dateRange.from, dateRange.to),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl border bg-muted/40" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No fee revenue data available for the selected period.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Fee Revenue Report</h2>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard
          label="Insurance Fee Income"
          value={formatCurrency(data.summary.insurance_fee_income)}
          subtitle="total for period"
        />
        <MetricCard
          label="Penalty Fee Income"
          value={formatCurrency(data.summary.penalty_fee_income)}
          subtitle="total for period"
        />
        <MetricCard
          label="Total Fee Income"
          value={formatCurrency(data.summary.total_fee_income)}
          subtitle={`${data.summary.loan_count} loans`}
        />
      </div>

      {/* Fee Revenue by Product — Bar Chart */}
      <FeeByProductChart data={data.by_product} />

      {/* Fee Revenue Monthly Trend — Line Chart */}
      <FeeMonthlyTrendChart data={data.by_month} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeeByProductChart({
  data,
}: {
  data: FeeRevenueData['by_product'];
}) {
  const chart = useChartTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Revenue by Product</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No product-level fee data yet.</p>
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: chart.axis }}
                  tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <YAxis
                  dataKey="product_name"
                  type="category"
                  tick={{ fontSize: 12, fill: chart.axis }}
                  width={140}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'insurance_fee_income' ? 'Insurance' : 'Penalty',
                  ]}
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chart.tooltipBorder}`,
                    backgroundColor: chart.tooltipBg,
                  }}
                />
                <Legend
                  formatter={(value: string) =>
                    value === 'insurance_fee_income' ? 'Insurance Fees' : 'Penalty Fees'
                  }
                />
                <Bar dataKey="insurance_fee_income" stackId="fees" fill="#6366f1" radius={[0, 0, 0, 0]} />
                <Bar dataKey="penalty_fee_income" stackId="fees" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeeMonthlyTrendChart({
  data,
}: {
  data: FeeRevenueData['by_month'];
}) {
  const chart = useChartTheme();

  const formattedData = data.map((item) => ({
    ...item,
    monthLabel: item.month,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Revenue Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No monthly trend data yet.</p>
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={formattedData}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 12, fill: chart.axis }}
                  tickLine={false}
                  axisLine={{ stroke: chart.grid }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: chart.axis }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      insurance_fee_income: 'Insurance Fees',
                      penalty_fee_income: 'Penalty Fees',
                      total_fee_income: 'Total Fees',
                    };
                    return [formatCurrency(value), labels[name] || name];
                  }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chart.tooltipBorder}`,
                    backgroundColor: chart.tooltipBg,
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    const labels: Record<string, string> = {
                      insurance_fee_income: 'Insurance Fees',
                      penalty_fee_income: 'Penalty Fees',
                      total_fee_income: 'Total Fees',
                    };
                    return labels[value] || value;
                  }}
                />
                <Line type="monotone" dataKey="total_fee_income" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="insurance_fee_income" stroke="#6366f1" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="penalty_fee_income" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
