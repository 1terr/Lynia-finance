'use client';

import { useState } from 'react';
import type { DatePreset, DateRange } from '@/types/reports';
import { cn } from '@/lib/utils';

const presets: { value: DatePreset; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'mtd', label: 'MTD' },
  { value: 'ytd', label: 'YTD' },
  { value: 'custom', label: 'Custom' },
];

function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();

  switch (preset) {
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '90d':
      from.setDate(from.getDate() - 90);
      break;
    case 'mtd':
      from.setDate(1);
      break;
    case 'ytd':
      from.setMonth(0, 1);
      break;
    default:
      from.setDate(from.getDate() - 30);
  }

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [activePreset, setActivePreset] = useState<DatePreset>(value.preset ?? '30d');

  const handlePreset = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset !== 'custom') {
      const dates = getPresetDates(preset);
      onChange({ ...dates, preset });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border bg-muted/50 p-0.5">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activePreset === p.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {activePreset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value, preset: 'custom' })}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value, preset: 'custom' })}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}
    </div>
  );
}

export { getPresetDates };
