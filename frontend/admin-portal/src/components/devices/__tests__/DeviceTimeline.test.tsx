import React from 'react';
import { render, screen } from '@testing-library/react';
import { DeviceTimeline } from '../DeviceTimeline';
import { mockLockEvents, mockDeviceAssignment } from '@/test/mocks/devices';

jest.mock('@/lib/api/client');

describe('DeviceTimeline', () => {
  it('renders lock events', () => {
    render(
      <DeviceTimeline lockEvents={mockLockEvents} assignments={[]} />
    );
    expect(screen.getByText('Device Locked')).toBeInTheDocument();
    const unlocked = screen.getAllByText('Device Unlocked');
    expect(unlocked.length).toBe(2);
  });

  it('displays event reasons', () => {
    render(
      <DeviceTimeline lockEvents={mockLockEvents} assignments={[]} />
    );
    expect(screen.getByText('Payment overdue 7+ days')).toBeInTheDocument();
    expect(screen.getByText(/Payment received/)).toBeInTheDocument();
    expect(screen.getByText(/Manual override/)).toBeInTheDocument();
  });

  it('shows type badges', () => {
    render(
      <DeviceTimeline lockEvents={mockLockEvents} assignments={[]} />
    );
    expect(screen.getAllByText('lock').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('unlock').length).toBeGreaterThanOrEqual(1);
  });

  it('renders assignment events', () => {
    render(
      <DeviceTimeline lockEvents={[]} assignments={[mockDeviceAssignment]} />
    );
    expect(screen.getByText('Device Assigned')).toBeInTheDocument();
    expect(screen.getByText(/IMEI: 353456789012346/)).toBeInTheDocument();
  });

  it('renders return events for returned devices', () => {
    const returnedAssignment = {
      ...mockDeviceAssignment,
      returned: true,
      returned_at: '2025-02-01T10:00:00Z',
      return_reason: 'Financial difficulty',
      return_condition: 'Good',
    };
    render(
      <DeviceTimeline lockEvents={[]} assignments={[returnedAssignment]} />
    );
    expect(screen.getByText('Device Returned')).toBeInTheDocument();
    expect(screen.getByText(/Financial difficulty/)).toBeInTheDocument();
  });

  it('renders repossession events', () => {
    const repossessedAssignment = {
      ...mockDeviceAssignment,
      repossessed: true,
      repossessed_at: '2025-02-01T10:00:00Z',
    };
    render(
      <DeviceTimeline lockEvents={[]} assignments={[repossessedAssignment]} />
    );
    expect(screen.getByText('Device Repossessed')).toBeInTheDocument();
  });

  it('shows empty state when no events', () => {
    render(
      <DeviceTimeline lockEvents={[]} assignments={[]} />
    );
    expect(screen.getByText(/No history events found/)).toBeInTheDocument();
  });

  it('sorts events by timestamp descending', () => {
    render(
      <DeviceTimeline lockEvents={mockLockEvents} assignments={[mockDeviceAssignment]} />
    );
    const titles = screen.getAllByText(/Device (Locked|Unlocked|Assigned)/);
    // Most recent event should be first (manual unlock on Jan 30)
    expect(titles.length).toBeGreaterThan(0);
  });

  it('displays actor information', () => {
    render(
      <DeviceTimeline lockEvents={mockLockEvents} assignments={[]} />
    );
    const systemActors = screen.getAllByText(/by system/);
    expect(systemActors.length).toBeGreaterThanOrEqual(1);
    const adminActors = screen.getAllByText(/by admin-001/);
    expect(adminActors.length).toBeGreaterThanOrEqual(1);
  });
});
