/**
 * Tests: Fineract Loan Approval Workflow (Phase 7 - T008)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FineractApprovalPage from '@/components/fineract/fineract-approval-page';
import * as fineractApi from '@/lib/api/fineract';
import { createMockPendingLoan } from '../fixtures/fineract-mocks';

jest.mock('@lynia/auth', () => ({
  getValidSession: jest.fn().mockResolvedValue({
    getIdToken: () => ({ getJwtToken: () => 'mock-jwt' }),
  }),
  signOut: jest.fn(),
}));
jest.mock('@lynia/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  formatCurrency: (v: number) => `$${(v / 100).toFixed(2)}`,
  formatDate: (d: string) => d,
}));
jest.mock('@/lib/api/fineract');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: (selector: (state: { hasPermission: (p: string) => boolean }) => unknown) =>
    selector({ hasPermission: () => true }),
}));

const mockedApi = fineractApi as jest.Mocked<typeof fineractApi>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('FineractApprovalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders pending loans from Fineract', async () => {
    const pending1 = createMockPendingLoan();
    const pending2 = createMockPendingLoan({
      lyniaLoanId: 'loan-pending-2',
      customerName: 'Tatenda Mhaka',
      fineractLoanId: 103,
    });

    mockedApi.getPendingApprovalLoans.mockResolvedValue({
      data: [pending1, pending2],
      total: 2,
      page: 1,
      limit: 25,
      total_pages: 1,
    });

    render(<FineractApprovalPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Chipo Ndlovu')).toBeInTheDocument();
      expect(screen.getByText('Tatenda Mhaka')).toBeInTheDocument();
    });
  });

  it('shows retry sync and reject buttons for each loan', async () => {
    mockedApi.getPendingApprovalLoans.mockResolvedValue({
      data: [createMockPendingLoan()],
      total: 1,
      page: 1,
      limit: 25,
      total_pages: 1,
    });

    render(<FineractApprovalPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Retry Sync')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });
  });

  it('shows confirmation dialog on retry sync click', async () => {
    mockedApi.getPendingApprovalLoans.mockResolvedValue({
      data: [createMockPendingLoan()],
      total: 1,
      page: 1,
      limit: 25,
      total_pages: 1,
    });

    render(<FineractApprovalPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Retry Sync')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry Sync'));

    await waitFor(() => {
      // Dialog opens with title "Retry Fineract Sync"
      expect(screen.getByText('Retry Fineract Sync')).toBeInTheDocument();
      // Dialog has its own "Retry Sync" confirm button (2 total on page now)
      const retrySyncButtons = screen.getAllByRole('button', { name: /Retry Sync/i });
      expect(retrySyncButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('calls Fineract retry sync API on confirmation', async () => {
    mockedApi.getPendingApprovalLoans.mockResolvedValue({
      data: [createMockPendingLoan()],
      total: 1,
      page: 1,
      limit: 25,
      total_pages: 1,
    });
    mockedApi.retryFineractSync.mockResolvedValue({
      success: true,
      message: 'Sync completed',
    });

    render(<FineractApprovalPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Retry Sync')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry Sync'));

    await waitFor(() => {
      expect(screen.getByText('Retry Fineract Sync')).toBeInTheDocument();
    });

    // Click the confirm "Retry Sync" button in the ConfirmationDialog (last one on page)
    const retrySyncButtons = screen.getAllByRole('button', { name: /Retry Sync/i });
    fireEvent.click(retrySyncButtons[retrySyncButtons.length - 1]);

    await waitFor(() => {
      expect(mockedApi.retryFineractSync).toHaveBeenCalledWith(
        'loan-pending-uuid'
      );
    });
  });

  it('shows empty state when no pending loans', async () => {
    mockedApi.getPendingApprovalLoans.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      total_pages: 0,
    });

    render(<FineractApprovalPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/No sync issues/)).toBeInTheDocument();
    });
  });

  it('shows loan product and amount details', async () => {
    mockedApi.getPendingApprovalLoans.mockResolvedValue({
      data: [createMockPendingLoan()],
      total: 1,
      page: 1,
      limit: 25,
      total_pages: 1,
    });

    render(<FineractApprovalPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Tier 1/)).toBeInTheDocument();
    });
  });
});
