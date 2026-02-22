import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
jest.mock('@/lib/api/payments', () => ({
  getOverdueCollections: jest.fn().mockResolvedValue([
    {
      id: 'loan-010',
      loan_id: 'loan-010',
      customer_id: 'cust-010',
      customer_name: 'Tendai Masara',
      customer_phone: '+263771111111',
      amount_due: 170.64,
      days_overdue: 75,
      missed_payments: 3,
      last_payment_date: '2025-09-01T00:00:00Z',
      next_payment_date: '2025-10-01T00:00:00Z',
      priority: 'critical',
    },
    {
      id: 'loan-011',
      loan_id: 'loan-011',
      customer_id: 'cust-011',
      customer_name: 'Blessing Chipo',
      customer_phone: '+263772222222',
      amount_due: 56.88,
      days_overdue: 20,
      missed_payments: 1,
      last_payment_date: '2025-11-01T00:00:00Z',
      next_payment_date: '2025-11-15T00:00:00Z',
      priority: 'medium',
    },
  ]),
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
  usePathname: () => '/payments/collections',
}));

import CollectionsPage from '../_client';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('CollectionsPage', () => {
  it('renders page header', () => {
    renderWithProviders(<CollectionsPage />);
    expect(screen.getByText('Collections Queue')).toBeInTheDocument();
    expect(screen.getByText('Manage overdue payment collections')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    renderWithProviders(<CollectionsPage />);
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Collections')).toBeInTheDocument();
  });

  it('renders export CSV button', () => {
    renderWithProviders(<CollectionsPage />);
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderWithProviders(<CollectionsPage />);
    expect(screen.getByPlaceholderText('Search by customer name or phone...')).toBeInTheDocument();
  });

  it('renders priority filter dropdown', () => {
    renderWithProviders(<CollectionsPage />);
    expect(screen.getByText('All Priorities')).toBeInTheDocument();
  });

  it('renders summary cards', async () => {
    renderWithProviders(<CollectionsPage />);
    expect(screen.getByText('Total Overdue')).toBeInTheDocument();
    expect(screen.getByText('Overdue Loans')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High Priority')).toBeInTheDocument();
  });
});
