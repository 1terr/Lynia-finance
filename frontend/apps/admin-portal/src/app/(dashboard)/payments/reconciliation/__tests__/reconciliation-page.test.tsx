import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/api/payments', () => ({
  fetchUnreconciledPayments: jest.fn().mockResolvedValue([]),
  reconcilePayment: jest.fn(),
}));

jest.mock('@/lib/auth/context', () => ({
  useAuth: () => ({
    user: { id: 'admin-001', role: 'super_admin' },
    isLoading: false,
  }),
}));

jest.mock('@/lib/auth/permissions', () => ({
  hasPermission: () => true,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/payments/reconciliation',
}));

import ReconciliationPage from '../_client';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('ReconciliationPage', () => {
  it('renders page header', () => {
    renderWithProviders(<ReconciliationPage />);
    expect(screen.getByText('Payment Reconciliation')).toBeInTheDocument();
    expect(screen.getByText('Review and reconcile confirmed payments with gateway records')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    renderWithProviders(<ReconciliationPage />);
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Reconciliation')).toBeInTheDocument();
  });

  it('renders unreconciled count', () => {
    renderWithProviders(<ReconciliationPage />);
    expect(screen.getByText('Unreconciled')).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    renderWithProviders(<ReconciliationPage />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });
});
