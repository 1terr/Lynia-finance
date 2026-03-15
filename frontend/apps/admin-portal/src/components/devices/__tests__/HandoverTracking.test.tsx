import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HandoverTracking } from '../HandoverTracking';
import { mockHandover, mockCompletedHandover, mockHandovers } from '@/test/mocks/devices';

jest.mock('@/lib/api/client');

describe('HandoverTracking', () => {
  const defaultProps = {
    handovers: mockHandovers,
    onUpdateStatus: jest.fn(),
    onComplete: jest.fn(),
    onCancel: jest.fn(),
  };

  it('renders handover list', () => {
    render(<HandoverTracking {...defaultProps} />);
    const names = screen.getAllByText('Tatenda Moyo');
    expect(names.length).toBeGreaterThanOrEqual(1);
  });

  it('displays device information', () => {
    render(<HandoverTracking {...defaultProps} />);
    const deviceTexts = screen.getAllByText(/Samsung Galaxy A14/);
    expect(deviceTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('displays handover status badges', () => {
    render(<HandoverTracking {...defaultProps} />);
    expect(screen.getByText('initiated')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('shows progress steps for active handovers', () => {
    render(<HandoverTracking {...defaultProps} />);
    expect(screen.getAllByText('Identity Verified').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Deposit Verified').length).toBeGreaterThanOrEqual(1);
  });

  it('displays checklist items', () => {
    render(<HandoverTracking {...defaultProps} />);
    // All verified items for the completed handover
    const identityVerified = screen.getAllByText('Identity Verified');
    expect(identityVerified.length).toBeGreaterThanOrEqual(1);
  });

  it('shows action buttons for in-progress handovers', () => {
    render(<HandoverTracking {...defaultProps} />);
    expect(screen.getByText(/Next:/)).toBeInTheDocument();
    expect(screen.getAllByText('Cancel').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onUpdateStatus when next step is clicked', () => {
    const onUpdateStatus = jest.fn();
    render(<HandoverTracking {...defaultProps} onUpdateStatus={onUpdateStatus} />);
    const nextButton = screen.getByText(/Next:/);
    fireEvent.click(nextButton);
    expect(onUpdateStatus).toHaveBeenCalledWith('ho-001', 'identity_verified');
  });

  it('calls onCancel when cancel is clicked and confirmed', () => {
    const onCancel = jest.fn();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<HandoverTracking {...defaultProps} onCancel={onCancel} />);
    const cancelButtons = screen.getAllByText('Cancel');
    fireEvent.click(cancelButtons[0]);
    expect(onCancel).toHaveBeenCalledWith('ho-001');
    (window.confirm as jest.Mock).mockRestore();
  });

  it('shows empty state when no handovers', () => {
    render(<HandoverTracking handovers={[]} />);
    expect(screen.getByText('No handovers found')).toBeInTheDocument();
  });

  it('shows scheduled date and time', () => {
    render(<HandoverTracking {...defaultProps} />);
    const scheduledTexts = screen.getAllByText(/Scheduled:/);
    expect(scheduledTexts.length).toBeGreaterThanOrEqual(1);
  });
});
