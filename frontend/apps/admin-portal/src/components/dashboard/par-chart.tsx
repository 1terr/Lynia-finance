'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@lynia/utils';
import { useChartTheme } from '@/hooks/use-chart-theme';
import type { PortfolioAtRisk } from '@/types';

interface PARChartProps {
  data: PortfolioAtRisk;
}

const BUCKET_COLORS = ['#f59e0b', '#f97316', '#ef4444', '#dc2626'];

export function PARChart({ data }: PARChartProps) {
  const chart = useChartTheme();
  const chartData = [
    { bucket: '0-30 days', amount: data.par_0_30 },
    { bucket: '31-60 days', amount: data.par_31_60 },
    { bucket: '61-90 days', amount: data.par_61_90 },
    { bucket: '90+ days', amount: data.par_90_plus },
  ];

  const totalAtRisk = Object.values(data).reduce((s, v) => s + v, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Portfolio at Risk</CardTitle>
        <span className="text-sm font-medium text-red-600">
          {formatCurrency(totalAtRisk)} at risk
        </span>
      </CardHeader>
      <CardContent>
        {totalAtRisk === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No overdue loans
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 12, fill: chart.axis }}
                  tickLine={false}
                  axisLine={{ stroke: chart.grid }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: chart.axis }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Amount at Risk']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chart.tooltipBorder}`,
                    backgroundColor: chart.tooltipBg,
                  }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={BUCKET_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
