import React from 'react';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '@/components/reports/metric-card';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Total Loans" value="47" />);
    expect(screen.getByText('Total Loans')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
  });

  it('renders positive change indicator', () => {
    render(<MetricCard label="Growth" value="12.5%" change={12.5} />);
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('renders negative change indicator', () => {
    render(<MetricCard label="Default Rate" value="3.5%" change={-2.1} />);
    expect(screen.getByText('-2.1%')).toBeInTheDocument();
  });

  it('renders zero change as flat', () => {
    render(<MetricCard label="Flat" value="0%" change={0} />);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('renders without change indicator when not provided', () => {
    const { container } = render(<MetricCard label="Simple" value="100" />);
    expect(container.querySelector('.text-green-600')).toBeNull();
    expect(container.querySelector('.text-red-600')).toBeNull();
  });

  it('renders subtitle when provided', () => {
    render(<MetricCard label="Test" value="42" subtitle="last 30 days" />);
    expect(screen.getByText('last 30 days')).toBeInTheDocument();
  });
});
