import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentDetail } from '../PaymentDetail';
import {
  mockPaymentWithCustomer,
  mockPendingPayment,
  mockFailedPayment,
} from '@/test/mocks/payments';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('PaymentDetail', () => {
  it('renders payment amount', () => {
    renderWithProviders(
      <PaymentDetail payment={mockPaymentWithCustomer} />
    );

    expect(screen.getByText('$56.88')).toBeInTheDocument();
  });

  it('shows payment status badge', () => {
    renderWithProviders(
      <PaymentDetail payment={mockPaymentWithCustomer} />
    );

    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('shows payment method', () => {
    renderWithProviders(
      <PaymentDetail payment={mockPaymentWithCustomer} />
    );

    expect(screen.getByText('ecocash')).toBeInTheDocument();
  });

  it('shows customer name', () => {
    renderWithProviders(
      <PaymentDetail payment={mockPaymentWithCustomer} />
    );

    expect(screen.getByText('John Moyo')).toBeInTheDocument();
  });

  it('shows payment allocation when available', () => {
    renderWithProviders(
      <PaymentDetail payment={mockPaymentWithCustomer} />
    );

    expect(screen.getByText('Payment Allocation')).toBeInTheDocument();
    expect(screen.getByText('$43.75')).toBeInTheDocument();
    expect(screen.getByText('$13.13')).toBeInTheDocument();
  });

  it('shows confirm/fail buttons for pending payments', () => {
    renderWithProviders(
      <PaymentDetail payment={mockPendingPayment} />
    );

    expect(screen.getByText('Confirm Payment')).toBeInTheDocument();
    expect(screen.getByText('Mark as Failed')).toBeInTheDocument();
  });

  it('shows refund button for confirmed payments', () => {
    renderWithProviders(
      <PaymentDetail payment={mockPaymentWithCustomer} />
    );

    expect(screen.getByText('Initiate Refund')).toBeInTheDocument();
  });

  it('shows reconcile button for unreconciled confirmed payments', () => {
    renderWithProviders(
      <PaymentDetail payment={mockPaymentWithCustomer} />
    );

    expect(screen.getByText('Mark as Reconciled')).toBeInTheDocument();
  });

  it('shows failure reason for failed payments', () => {
    renderWithProviders(
      <PaymentDetail payment={mockFailedPayment} />
    );

    // Failure reason appears in both the info field and status message
    expect(screen.getAllByText(/Insufficient funds/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows reference number', () => {
    renderWithProviders(
      <PaymentDetail payment={mockPaymentWithCustomer} />
    );

    expect(screen.getByText('REF-001')).toBeInTheDocument();
  });
});
