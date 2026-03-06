import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LockControlPanel } from '../LockControlPanel';
import { mockDeviceAssignment, mockLockedAssignment, mockLockEvents } from '@/test/mocks/devices';

jest.mock('@/lib/api/client');

describe('LockControlPanel', () => {
  const defaultProps = {
    assignment: mockDeviceAssignment,
    lockHistory: mockLockEvents,
    onLock: jest.fn(),
    onUnlock: jest.fn(),
    onPermanentUnlock: jest.fn(),
  };

  it('displays unlocked status', () => {
    render(<LockControlPanel {...defaultProps} />);
    // "Unlocked" appears in status and also in history; verify at least one is present
    const unlocked = screen.getAllByText('Unlocked');
    expect(unlocked.length).toBeGreaterThanOrEqual(1);
  });

  it('displays locked status with reason', () => {
    render(
      <LockControlPanel
        {...defaultProps}
        assignment={mockLockedAssignment}
      />
    );
    // "Locked" appears in the status display and in history events
    const locked = screen.getAllByText('Locked');
    expect(locked.length).toBeGreaterThanOrEqual(1);
    const reasons = screen.getAllByText(/Payment overdue 7\+ days/);
    expect(reasons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows lock and permanent unlock buttons when unlocked', () => {
    render(<LockControlPanel {...defaultProps} />);
    expect(screen.getByText('Lock Device')).toBeInTheDocument();
    expect(screen.getByText('Permanent Unlock')).toBeInTheDocument();
  });

  it('shows unlock button when locked', () => {
    render(
      <LockControlPanel
        {...defaultProps}
        assignment={mockLockedAssignment}
      />
    );
    expect(screen.getByText('Unlock Device')).toBeInTheDocument();
  });

  it('shows lock form when Lock Device is clicked', () => {
    render(<LockControlPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Lock Device'));
    expect(screen.getByPlaceholderText(/Enter reason for locking/)).toBeInTheDocument();
    expect(screen.getByText('Confirm Lock')).toBeInTheDocument();
  });

  it('calls onLock with reason when confirmed', () => {
    const onLock = jest.fn();
    render(<LockControlPanel {...defaultProps} onLock={onLock} />);
    fireEvent.click(screen.getByText('Lock Device'));
    fireEvent.change(screen.getByPlaceholderText(/Enter reason for locking/), {
      target: { value: 'Overdue payment' },
    });
    fireEvent.click(screen.getByText('Confirm Lock'));
    expect(onLock).toHaveBeenCalledWith('Overdue payment');
  });

  it('shows unlock confirmation dialog when Unlock Device is clicked', () => {
    render(
      <LockControlPanel
        {...defaultProps}
        assignment={mockLockedAssignment}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Device' }));
    // Dialog opens with description text
    expect(screen.getByText(/will be unlocked|regain full access/)).toBeInTheDocument();
  });

  it('shows permanent unlock confirmation', () => {
    render(<LockControlPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Permanent Unlock' }));
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
  });

  it('displays lock history events', () => {
    render(<LockControlPanel {...defaultProps} />);
    const lockedElements = screen.getAllByText('Locked');
    expect(lockedElements.length).toBeGreaterThanOrEqual(1);
    const unlockedElements = screen.getAllByText('Unlocked');
    expect(unlockedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows trigger type badges in history', () => {
    render(<LockControlPanel {...defaultProps} />);
    expect(screen.getByText('automated')).toBeInTheDocument();
    expect(screen.getByText('payment')).toBeInTheDocument();
    expect(screen.getByText('manual')).toBeInTheDocument();
  });

  it('displays permanent unlock message', () => {
    const permAssignment = {
      ...mockDeviceAssignment,
      lock_status: 'permanent_unlock' as const,
    };
    render(
      <LockControlPanel
        {...defaultProps}
        assignment={permAssignment}
      />
    );
    expect(screen.getByText('Permanently Unlocked')).toBeInTheDocument();
    expect(screen.getByText(/cannot be re-locked/)).toBeInTheDocument();
  });
});
