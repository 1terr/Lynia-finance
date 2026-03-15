'use client';

import { useTheme } from 'next-themes';

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return {
    grid: isDark ? '#374151' : '#e5e7eb',
    axis: isDark ? '#9ca3af' : '#6b7280',
    tooltipBg: isDark ? '#1f2937' : '#ffffff',
    tooltipBorder: isDark ? '#374151' : '#e5e7eb',
    tooltipText: isDark ? '#f3f4f6' : '#374151',
  };
}
