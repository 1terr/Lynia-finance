import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerTable } from '../CustomerTable';
import { mockCustomer, mockCustomer2 } from '@/test/mocks/customers';

describe('CustomerTable', () => {
  const defaultProps = {
    customers: [mockCustomer, mockCustomer2],
    total: 2,
    page: 1,
    limit: 25,
    isLoading: false,
    onPageChange: jest.fn(),
  };

  it('renders customer rows', () => {
    render(<CustomerTable {...defaultProps} />);

    expect(screen.getByText('John Moyo')).toBeInTheDocument();
    expect(screen.getByText('Jane Dube')).toBeInTheDocument();
  });

  it('displays customer phone numbers', () => {
    render(<CustomerTable {...defaultProps} />);

    expect(screen.getByText('+263771234567')).toBeInTheDocument();
    expect(screen.getByText('+263779876543')).toBeInTheDocument();
  });

  it('shows KYC status badges', () => {
    render(<CustomerTable {...defaultProps} />);

    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows credit tier badges', () => {
    render(<CustomerTable {...defaultProps} />);

    expect(screen.getByText('Tier 2')).toBeInTheDocument();
    expect(screen.getByText('Tier 1')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<CustomerTable {...defaultProps} isLoading={true} />);

    expect(screen.getByText('Loading customers...')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(<CustomerTable {...defaultProps} customers={[]} total={0} />);

    expect(screen.getByText('No customers found')).toBeInTheDocument();
  });

  it('renders View links to customer detail pages', () => {
    render(<CustomerTable {...defaultProps} />);

    const viewLinks = screen.getAllByText('View');
    expect(viewLinks).toHaveLength(2);
    expect(viewLinks[0].closest('a')).toHaveAttribute(
      'href',
      `/dashboard/customers/${mockCustomer.id}`
    );
  });

  it('shows pagination info', () => {
    render(<CustomerTable {...defaultProps} />);

    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('displays active loans count', () => {
    render(<CustomerTable {...defaultProps} />);

    expect(screen.getByText('1 active')).toBeInTheDocument();
    expect(screen.getByText('0 active')).toBeInTheDocument();
  });

  it('shows customer initials avatar', () => {
    render(<CustomerTable {...defaultProps} />);

    expect(screen.getByText('JM')).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('calls onPageChange when clicking pagination', () => {
    const onPageChange = jest.fn();
    render(
      <CustomerTable
        {...defaultProps}
        total={50}
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
