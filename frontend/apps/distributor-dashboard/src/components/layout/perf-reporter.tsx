'use client';

import { usePageTiming } from '@/hooks/use-page-timing';

export function PerfReporter() {
  usePageTiming();
  return null;
}
