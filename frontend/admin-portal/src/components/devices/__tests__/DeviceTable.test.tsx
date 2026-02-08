import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeviceTable } from '../DeviceTable';
import { mockDevices } from '@/test/mocks/devices';

jest.mock('@/lib/supabase/client');

describe('DeviceTable', () => {
  const defaultProps = {
    devices: mockDevices,
    total: 3,
    page: 1,
    limit: 20,
    onPageChange: jest.fn(),
  };

  it('renders device list correctly', () => {
    render(<DeviceTable {...defaultProps} />);
    expect(screen.getByText('Samsung Galaxy A14')).toBeInTheDocument();
    expect(screen.getByText('Tecno Spark 10 Pro')).toBeInTheDocument();
    expect(screen.getByText('Infinix Hot 30')).toBeInTheDocument();
  });

  it('displays device SKU and IMEI', () => {
    render(<DeviceTable {...defaultProps} />);
    expect(screen.getByText('SAM-A14-128-BLK')).toBeInTheDocument();
    expect(screen.getByText('353456789012345')).toBeInTheDocument();
  });

  it('displays status badges', () => {
    render(<DeviceTable {...defaultProps} />);
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('Damaged')).toBeInTheDocument();
  });

  it('displays pricing information', () => {
    render(<DeviceTable {...defaultProps} />);
    const prices = screen.getAllByText(/\$234\.00/);
    expect(prices.length).toBeGreaterThanOrEqual(1);
  });

  it('displays lock status', () => {
    render(<DeviceTable {...defaultProps} />);
    const enabledElements = screen.getAllByText('Enabled');
    expect(enabledElements.length).toBe(3);
  });

  it('displays distributor names', () => {
    render(<DeviceTable {...defaultProps} />);
    const techZone = screen.getAllByText('TechZone Harare');
    expect(techZone.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('PhoneWorld Bulawayo')).toBeInTheDocument();
  });

  it('renders view links for each device', () => {
    render(<DeviceTable {...defaultProps} />);
    const viewLinks = screen.getAllByText('View');
    expect(viewLinks).toHaveLength(3);
  });

  it('shows empty state when no devices', () => {
    render(<DeviceTable {...defaultProps} devices={[]} total={0} />);
    expect(screen.getByText('No devices found')).toBeInTheDocument();
  });

  it('renders checkboxes when selection is enabled', () => {
    const onSelectDevice = jest.fn();
    const onSelectAll = jest.fn();
    render(
      <DeviceTable
        {...defaultProps}
        selectedDevices={[]}
        onSelectDevice={onSelectDevice}
        onSelectAll={onSelectAll}
      />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(4); // 1 header + 3 rows
  });

  it('calls onSelectDevice when checkbox is clicked', () => {
    const onSelectDevice = jest.fn();
    const onSelectAll = jest.fn();
    render(
      <DeviceTable
        {...defaultProps}
        selectedDevices={[]}
        onSelectDevice={onSelectDevice}
        onSelectAll={onSelectAll}
      />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // Click first row checkbox
    expect(onSelectDevice).toHaveBeenCalledWith('dev-001');
  });

  it('displays storage and RAM specs', () => {
    render(<DeviceTable {...defaultProps} />);
    expect(screen.getByText('128GB / 4GB RAM')).toBeInTheDocument();
    expect(screen.getByText('256GB / 8GB RAM')).toBeInTheDocument();
  });
});
