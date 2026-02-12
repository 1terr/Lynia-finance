import React from 'react';
import { render, screen } from '@testing-library/react';
import { DeviceSummaryCards } from '../DeviceSummaryCards';
import { mockInventorySummary } from '@/test/mocks/devices';

jest.mock('@/lib/api/client');

describe('DeviceSummaryCards', () => {
  it('displays summary values', () => {
    render(<DeviceSummaryCards summary={mockInventorySummary} />);
    expect(screen.getByText('150')).toBeInTheDocument(); // total
    expect(screen.getByText('80')).toBeInTheDocument(); // available
    expect(screen.getByText('40')).toBeInTheDocument(); // assigned
    expect(screen.getByText('15')).toBeInTheDocument(); // reserved
    expect(screen.getByText('7')).toBeInTheDocument(); // damaged
    expect(screen.getByText('3')).toBeInTheDocument(); // returned
  });

  it('displays card labels', () => {
    render(<DeviceSummaryCards summary={mockInventorySummary} />);
    expect(screen.getByText('Total Devices')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('Reserved')).toBeInTheDocument();
    expect(screen.getByText('Damaged')).toBeInTheDocument();
    expect(screen.getByText('Returned')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    const { container } = render(<DeviceSummaryCards summary={null} loading />);
    const animatePulse = container.querySelectorAll('.animate-pulse');
    expect(animatePulse.length).toBe(6);
  });

  it('shows zero values when summary is null', () => {
    render(<DeviceSummaryCards summary={null} />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(6);
  });
});
