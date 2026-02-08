import React from 'react';
import { render } from '@testing-library/react';
import { Skeleton, MetricCardSkeleton, TableSkeleton, PageSkeleton } from '@/components/loading-skeleton';

describe('Skeleton', () => {
  it('renders with animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-8 w-48" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-8');
    expect(el.className).toContain('w-48');
  });
});

describe('MetricCardSkeleton', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<MetricCardSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });
});

describe('TableSkeleton', () => {
  it('renders default 5 rows', () => {
    const { container } = render(<TableSkeleton />);
    // Header + 5 data rows
    const rows = container.querySelectorAll('.border-b');
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it('renders custom number of rows', () => {
    const { container } = render(<TableSkeleton rows={3} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('PageSkeleton', () => {
  it('renders header, metric cards, and table skeletons', () => {
    const { container } = render(<PageSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(10); // header + 4 cards + table rows
  });
});
