import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/api/loans', () => ({
  getPendingLoans: jest.fn().mockResolvedValue({
    data: [],
    total: 0,
    page: 1,
    limit: 25,
    total_pages: 0,
  }),
  approveLoan: jest.fn(),
  rejectLoan: jest.fn(),
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
  usePathname: () => '/loans/pending-approval',
}));

import PendingApprovalPage from '../_client';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('PendingApprovalPage', () => {
  it('renders page header', () => {
    renderWithProviders(<PendingApprovalPage />);
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    expect(screen.getByText('Loan applications awaiting approval')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    renderWithProviders(<PendingApprovalPage />);
    expect(screen.getByText('Loans')).toBeInTheDocument();
  });

  it('shows empty state when no pending loans', async () => {
    renderWithProviders(<PendingApprovalPage />);
    expect(await screen.findByText('All caught up!')).toBeInTheDocument();
    expect(screen.getByText('No loan applications pending approval.')).toBeInTheDocument();
  });
});
