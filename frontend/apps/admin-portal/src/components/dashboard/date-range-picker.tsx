'use client';

import { useState } from 'react';
import { cn } from '@lynia/utils';
import { Calendar, ChevronDown } from 'lucide-react';

export type DateRange = '7d' | '30d' | '90d' | 'ytd' | 'custom';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
];

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = RANGE_OPTIONS.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm hover:bg-accent"
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {selected?.label || 'Select range'}
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            role="presentation"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-card py-1 shadow-lg">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'block w-full px-4 py-2 text-left text-sm hover:bg-accent',
                  value === option.value
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function dateRangeToDays(range: DateRange): number {
  switch (range) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case 'ytd': {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      return Math.ceil((now.getTime() - start.getTime()) / 86400000);
    }
    default: return 30;
  }
}

/** Convert a DateRange preset to ISO date strings (from/to). */
export function dateRangeToISO(range: DateRange): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  const days = dateRangeToDays(range);
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}
