'use client';

import { cn } from '@lynia/utils';

interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: BarChartItem[];
  title?: string;
  valueFormatter?: (v: number) => string;
  className?: string;
}

export function SimpleBarChart({ data, title, valueFormatter, className }: SimpleBarChartProps) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const format = valueFormatter ?? ((v: number) => v.toLocaleString());

  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow-sm', className)}>
      {title && <h3 className="text-sm font-semibold mb-4">{title}</h3>}
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{format(item.value)}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted">
              <div
                className={cn('h-2.5 rounded-full transition-all duration-500', item.color ?? 'bg-primary')}
                style={{ width: `${(item.value / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
