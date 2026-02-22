'use client';

import { cn } from '@lynia/utils';

interface DonutItem {
  label: string;
  value: number;
  pct: number;
  color: string;
}

interface DonutChartProps {
  data: DonutItem[];
  title?: string;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

const COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500',
  'bg-cyan-500', 'bg-orange-500', 'bg-pink-500',
];

export function DonutChart({ data, title, centerLabel, centerValue, className }: DonutChartProps) {
  // Build conic gradient segments
  let cumPct = 0;
  const gradientStops = data.map((item, i) => {
    const start = cumPct;
    cumPct += item.pct;
    const colorMap: Record<string, string> = {
      'bg-blue-500': '#3b82f6', 'bg-green-500': '#22c55e', 'bg-yellow-500': '#eab308',
      'bg-red-500': '#ef4444', 'bg-purple-500': '#a855f7', 'bg-cyan-500': '#06b6d4',
      'bg-orange-500': '#f97316', 'bg-pink-500': '#ec4899',
    };
    const hex = colorMap[item.color] ?? colorMap[COLORS[i % COLORS.length]];
    return `${hex} ${start}% ${cumPct}%`;
  });

  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow-sm', className)}>
      {title && <h3 className="text-sm font-semibold mb-4">{title}</h3>}
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative flex-shrink-0">
          <div
            className="h-28 w-28 rounded-full"
            style={{
              background: `conic-gradient(${gradientStops.join(', ')})`,
            }}
          >
            <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-card">
              {centerValue && <span className="text-lg font-bold">{centerValue}</span>}
              {centerLabel && <span className="text-[10px] text-muted-foreground">{centerLabel}</span>}
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="flex-1 space-y-2">
          {data.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={cn('h-2.5 w-2.5 rounded-full', item.color || COLORS[i % COLORS.length])} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
              <span className="font-medium">{item.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { COLORS };
