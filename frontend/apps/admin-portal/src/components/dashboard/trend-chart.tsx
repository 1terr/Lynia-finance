'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@lynia/utils';
import { useChartTheme } from '@/hooks/use-chart-theme';
import { BarChart3 } from 'lucide-react';
import type { DailyTrend } from '@/types';

interface TrendChartProps {
  data: DailyTrend[];
  title?: string;
}

export function TrendChart({ data, title = 'Disbursements & Collections' }: TrendChartProps) {
  const chart = useChartTheme();
  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">No data available</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Trend data will appear here once disbursements or collections are recorded.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={formattedData}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="disbursementGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="collectionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: chart.axis }}
                  tickLine={false}
                  axisLine={{ stroke: chart.grid }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: chart.axis }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'disbursements' ? 'Disbursements' : 'Collections',
                  ]}
                  labelStyle={{ color: chart.tooltipText }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chart.tooltipBorder}`,
                    backgroundColor: chart.tooltipBg,
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value === 'disbursements' ? 'Disbursements' : 'Collections'
                  }
                />
                <Area
                  type="monotone"
                  dataKey="disbursements"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#disbursementGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="collections"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#collectionGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
