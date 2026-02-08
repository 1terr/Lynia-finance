import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReconciliationTable } from '../ReconciliationTable';
import { mockPaymentWithCustomer } from '@/test/mocks/payments';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('ReconciliationTable', () => {
  it('renders unreconciled payments', () => {
    renderWithProviders(
      <ReconciliationTable
        payments={[mockPaymentWithCustomer]}
        isLoading={false}
      />
    );

    expect(screen.getByText('John Moyo')).toBeInTheDocument();
    expect(screen.getByText('$56.88')).toBeInTheDocument();
  });

  it('shows Reconcile button', () => {
    renderWithProviders(
      <ReconciliationTable
        payments={[mockPaymentWithCustomer]}
        isLoading={false}
      />
    );

    expect(screen.getByText('Reconcile')).toBeInTheDocument();
  });

  it('shows payment method', () => {
    renderWithProviders(
      <ReconciliationTable
        payments={[mockPaymentWithCustomer]}
        isLoading={false}
      />
    );

    expect(screen.getByText('ecocash')).toBeInTheDocument();
  });

  it('shows reference number', () => {
    renderWithProviders(
      <ReconciliationTable
        payments={[mockPaymentWithCustomer]}
        isLoading={false}
      />
    );

    expect(screen.getByText('REF-001')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderWithProviders(
      <ReconciliationTable payments={[]} isLoading={true} />
    );

    expect(
      screen.getByText('Loading unreconciled payments...')
    ).toBeInTheDocument();
  });

  it('shows empty state when all reconciled', () => {
    renderWithProviders(
      <ReconciliationTable payments={[]} isLoading={false} />
    );

    expect(
      screen.getByText('All payments reconciled')
    ).toBeInTheDocument();
  });
});
