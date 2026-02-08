import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreditScoreCard } from '../CreditScoreCard';
import { mockCustomerWithRelations } from '@/test/mocks/customers';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('CreditScoreCard', () => {
  it('renders credit score', () => {
    renderWithProviders(
      <CreditScoreCard customer={mockCustomerWithRelations} />
    );

    expect(screen.getByText('620')).toBeInTheDocument();
    expect(screen.getByText('/ 1000')).toBeInTheDocument();
  });

  it('shows credit tier', () => {
    renderWithProviders(
      <CreditScoreCard customer={mockCustomerWithRelations} />
    );

    expect(screen.getByText('Tier 2')).toBeInTheDocument();
  });

  it('shows credit limit', () => {
    renderWithProviders(
      <CreditScoreCard customer={mockCustomerWithRelations} />
    );

    expect(screen.getByText('$350.00')).toBeInTheDocument();
  });

  it('shows completed loans count', () => {
    renderWithProviders(
      <CreditScoreCard customer={mockCustomerWithRelations} />
    );

    expect(screen.getByText('Completed Loans')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows defaulted loans count', () => {
    renderWithProviders(
      <CreditScoreCard customer={mockCustomerWithRelations} />
    );

    expect(screen.getByText('Defaulted Loans')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
