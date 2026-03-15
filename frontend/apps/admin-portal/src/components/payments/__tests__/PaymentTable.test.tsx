import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentTable } from '../PaymentTable';
import {
  mockPaymentWithCustomer,
  mockPendingPayment,
  mockFailedPayment,
} from '@/test/mocks/payments';

describe('PaymentTable', () => {
  const defaultProps = {
    payments: [mockPaymentWithCustomer, mockPendingPayment, mockFailedPayment],
    total: 3,
    page: 1,
    limit: 25,
    isLoading: false,
    onPageChange: jest.fn(),
  };

  it('renders payment rows', () => {
    render(<PaymentTable {...defaultProps} />);

    // John Moyo appears twice (confirmed + failed payments share customer)
    expect(screen.getAllByText('John Moyo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Jane Dube')).toBeInTheDocument();
  });

  it('shows payment amounts', () => {
    render(<PaymentTable {...defaultProps} />);

    expect(screen.getAllByText('$56.88').length).toBeGreaterThanOrEqual(1);
  });

  it('shows payment status badges', () => {
    render(<PaymentTable {...defaultProps} />);

    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows payment method', () => {
    render(<PaymentTable {...defaultProps} />);

    expect(screen.getAllByText('ecocash').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading state', () => {
    render(<PaymentTable {...defaultProps} isLoading={true} />);

    expect(screen.getByText('Loading payments...')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(
      <PaymentTable {...defaultProps} payments={[]} total={0} />
    );

    expect(screen.getByText('No payments found')).toBeInTheDocument();
  });

  it('renders View links', () => {
    render(<PaymentTable {...defaultProps} />);

    const viewLinks = screen.getAllByText('View');
    expect(viewLinks).toHaveLength(3);
  });

  it('shows payment type', () => {
    render(<PaymentTable {...defaultProps} />);

    expect(screen.getAllByText('installment').length).toBeGreaterThanOrEqual(1);
  });

  it('shows customer phone numbers', () => {
    render(<PaymentTable {...defaultProps} />);

    // Phone numbers are masked for privacy
    expect(screen.getAllByText('+263****567').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('+263****543')).toBeInTheDocument();
  });

  it('calls onPageChange when clicking pagination', () => {
    const onPageChange = jest.fn();
    render(
      <PaymentTable
        {...defaultProps}
        total={50}
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
