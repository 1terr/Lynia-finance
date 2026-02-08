import React from 'react';
import { render, screen } from '@testing-library/react';
import { CustomerPayments } from '../CustomerPayments';
import { mockPayment } from '@/test/mocks/customers';

describe('CustomerPayments', () => {
  it('renders payment table', () => {
    render(<CustomerPayments payments={[mockPayment]} />);

    expect(screen.getByText('Payment History (1)')).toBeInTheDocument();
  });

  it('shows payment amount', () => {
    render(<CustomerPayments payments={[mockPayment]} />);

    // Amount appears in both the table row and the total confirmed section
    expect(screen.getAllByText('$56.88').length).toBeGreaterThanOrEqual(1);
  });

  it('shows payment status', () => {
    render(<CustomerPayments payments={[mockPayment]} />);

    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('shows payment type', () => {
    render(<CustomerPayments payments={[mockPayment]} />);

    expect(screen.getByText('installment')).toBeInTheDocument();
  });

  it('shows payment method', () => {
    render(<CustomerPayments payments={[mockPayment]} />);

    expect(screen.getByText('ecocash')).toBeInTheDocument();
  });

  it('shows total confirmed amount', () => {
    render(<CustomerPayments payments={[mockPayment]} />);

    expect(screen.getByText('Total Confirmed')).toBeInTheDocument();
  });

  it('shows empty state when no payments', () => {
    render(<CustomerPayments payments={[]} />);

    expect(screen.getByText('No payments found')).toBeInTheDocument();
  });

  it('shows reference number', () => {
    render(<CustomerPayments payments={[mockPayment]} />);

    expect(screen.getByText('REF-001')).toBeInTheDocument();
  });
});
