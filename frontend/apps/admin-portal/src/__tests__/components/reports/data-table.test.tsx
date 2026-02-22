import React from 'react';
import { render, screen } from '@testing-library/react';
import { DataTable } from '@/components/reports/data-table';

const mockColumns = [
  { key: 'name', header: 'Name' },
  { key: 'value', header: 'Value', align: 'right' as const },
  { key: 'pct', header: 'Percentage', align: 'right' as const, render: (row: Record<string, unknown>) => `${row.pct}%` },
];

const mockData = [
  { name: 'Active', value: 58, pct: 48.3 },
  { name: 'Locked', value: 8, pct: 6.7 },
  { name: 'In Stock', value: 35, pct: 29.2 },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Percentage')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText('In Stock')).toBeInTheDocument();
  });

  it('renders custom render functions', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);
    expect(screen.getByText('48.3%')).toBeInTheDocument();
    expect(screen.getByText('6.7%')).toBeInTheDocument();
  });

  it('renders plain values for columns without render', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);
    expect(screen.getByText('58')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders empty state message when no data', () => {
    render(<DataTable columns={mockColumns} data={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });
});
