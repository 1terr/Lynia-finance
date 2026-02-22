'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { LoansByStatus } from '@/types';

interface PortfolioChartProps {
  data: LoansByStatus[];
}

const STATUS_COLORS: Record<string, string> = {
  active: '#3b82f6',
  pending: '#f59e0b',
  approved: '#10b981',
  paid_off: '#6366f1',
  defaulted: '#ef4444',
  rejected: '#9ca3af',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  approved: 'Approved',
  paid_off: 'Paid Off',
  defaulted: 'Defaulted',
  rejected: 'Rejected',
};

export function PortfolioChart({ data }: PortfolioChartProps) {
  const chartData = data.map((item) => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: item.count,
    amount: item.total_amount,
    color: STATUS_COLORS[item.status] || '#9ca3af',
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Portfolio</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
            No loan data available
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-[280px] w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} loans`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-2">
              {chartData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {item.value}
                    </span>
                    <span className="text-sm text-gray-400 ml-1">
                      ({total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
