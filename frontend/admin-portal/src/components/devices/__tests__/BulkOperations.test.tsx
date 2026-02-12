import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkOperations } from '../BulkOperations';

jest.mock('@/lib/api/client');

describe('BulkOperations', () => {
  const defaultProps = {
    selectedCount: 3,
    onBulkStatusChange: jest.fn(),
    onBulkAssignDistributor: jest.fn(),
    onClearSelection: jest.fn(),
    distributors: [
      { id: 'dist-001', business_name: 'TechZone Harare' },
      { id: 'dist-002', business_name: 'PhoneWorld Bulawayo' },
    ],
  };

  it('renders nothing when no devices selected', () => {
    const { container } = render(
      <BulkOperations {...defaultProps} selectedCount={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('displays selected count', () => {
    render(<BulkOperations {...defaultProps} />);
    expect(screen.getByText('3 devices selected')).toBeInTheDocument();
  });

  it('shows singular form for 1 device', () => {
    render(<BulkOperations {...defaultProps} selectedCount={1} />);
    expect(screen.getByText('1 device selected')).toBeInTheDocument();
  });

  it('renders action dropdown', () => {
    render(<BulkOperations {...defaultProps} />);
    const select = screen.getByLabelText('Bulk action');
    expect(select).toBeInTheDocument();
  });

  it('shows distributor dropdown when assign distributor is selected', () => {
    render(<BulkOperations {...defaultProps} />);
    const select = screen.getByLabelText('Bulk action');
    fireEvent.change(select, { target: { value: 'assign_distributor' } });
    expect(screen.getByLabelText('Select distributor for bulk assignment')).toBeInTheDocument();
  });

  it('shows confirmation when Apply is clicked', () => {
    render(<BulkOperations {...defaultProps} />);
    const select = screen.getByLabelText('Bulk action');
    fireEvent.change(select, { target: { value: 'available' } });
    fireEvent.click(screen.getByText('Apply'));
    expect(screen.getByText('Confirm?')).toBeInTheDocument();
    expect(screen.getByText('Yes, Apply')).toBeInTheDocument();
  });

  it('calls onBulkStatusChange when confirmed', () => {
    const onBulkStatusChange = jest.fn();
    render(<BulkOperations {...defaultProps} onBulkStatusChange={onBulkStatusChange} />);
    const select = screen.getByLabelText('Bulk action');
    fireEvent.change(select, { target: { value: 'damaged' } });
    fireEvent.click(screen.getByText('Apply'));
    fireEvent.click(screen.getByText('Yes, Apply'));
    expect(onBulkStatusChange).toHaveBeenCalledWith('damaged');
  });

  it('calls onBulkAssignDistributor when distributor assignment is confirmed', () => {
    const onBulkAssignDistributor = jest.fn();
    render(<BulkOperations {...defaultProps} onBulkAssignDistributor={onBulkAssignDistributor} />);
    const actionSelect = screen.getByLabelText('Bulk action');
    fireEvent.change(actionSelect, { target: { value: 'assign_distributor' } });
    const distSelect = screen.getByLabelText('Select distributor for bulk assignment');
    fireEvent.change(distSelect, { target: { value: 'dist-001' } });
    fireEvent.click(screen.getByText('Apply'));
    fireEvent.click(screen.getByText('Yes, Apply'));
    expect(onBulkAssignDistributor).toHaveBeenCalledWith('dist-001');
  });

  it('calls onClearSelection when clear is clicked', () => {
    const onClearSelection = jest.fn();
    render(<BulkOperations {...defaultProps} onClearSelection={onClearSelection} />);
    fireEvent.click(screen.getByText('Clear selection'));
    expect(onClearSelection).toHaveBeenCalled();
  });
});
