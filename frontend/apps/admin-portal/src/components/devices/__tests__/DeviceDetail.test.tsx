import React from 'react';
import { render, screen } from '@testing-library/react';
import { DeviceDetail } from '../DeviceDetail';
import { mockAvailableDevice } from '@/test/mocks/devices';

jest.mock('@/lib/api/client');

describe('DeviceDetail', () => {
  it('renders device name and SKU', () => {
    render(<DeviceDetail device={mockAvailableDevice} />);
    expect(screen.getByText('Samsung Galaxy A14')).toBeInTheDocument();
    expect(screen.getByText(/SAM-A14-128-BLK/)).toBeInTheDocument();
  });

  it('displays IMEI', () => {
    render(<DeviceDetail device={mockAvailableDevice} />);
    expect(screen.getByText(/353456789012345/)).toBeInTheDocument();
  });

  it('displays status badge', () => {
    render(<DeviceDetail device={mockAvailableDevice} />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('displays featured badge when device is featured', () => {
    render(<DeviceDetail device={mockAvailableDevice} />);
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('displays specifications', () => {
    render(<DeviceDetail device={mockAvailableDevice} />);
    expect(screen.getByText('Android 13')).toBeInTheDocument();
    expect(screen.getByText('MediaTek Helio G80')).toBeInTheDocument();
    expect(screen.getByText('4 GB')).toBeInTheDocument();
    expect(screen.getByText('128 GB')).toBeInTheDocument();
    expect(screen.getByText('5000 mAh')).toBeInTheDocument();
    expect(screen.getByText('50MP + 2MP')).toBeInTheDocument();
  });

  it('displays pricing information', () => {
    render(<DeviceDetail device={mockAvailableDevice} />);
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.getByText('$180.00')).toBeInTheDocument();
    expect(screen.getByText('$234.00')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
  });

  it('displays profit margin', () => {
    render(<DeviceDetail device={mockAvailableDevice} />);
    // margin = 180 - 120 = $60, margin % = 50%
    expect(screen.getByText(/\$60\.00/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it('displays distributor information', () => {
    render(<DeviceDetail device={mockAvailableDevice} />);
    expect(screen.getByText('TechZone Harare')).toBeInTheDocument();
    expect(screen.getByText('James Moyo')).toBeInTheDocument();
    expect(screen.getByText('Harare Central')).toBeInTheDocument();
  });

  it('displays lock information', () => {
    render(<DeviceDetail device={mockAvailableDevice} />);
    expect(screen.getByText('Yes')).toBeInTheDocument(); // Lock enabled
    expect(screen.getByText('trustonic')).toBeInTheDocument();
  });
});
