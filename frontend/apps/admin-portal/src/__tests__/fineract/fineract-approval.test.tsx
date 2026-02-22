/**
 * Tests: Fineract Loan Approval Workflow (Phase 7 - T008)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FineractApprovalPage from '@/components/fineract/fineract-approval-page';
import * as fineractApi from '@/lib/api/fineract';
import { createMockPendingLoan, createMockLoanView } from '../fixtures/fineract-mocks';

jest.mock('@/lib/api/fineract');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
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

  it('shows approve and reject buttons for each loan', async () => {
    mockedApi.getPendingApprovalLoans.mockResolvedValue({
      data: [createMockPendingLoan()],
      total: 1,
      page: 1,
      limit: 25,
      total_pages: 1,
    });

    render(<FineractApprovalPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });
  });

  it('shows confirmation modal on approve click', async () => {
    mockedApi.getPendingApprovalLoans.mockResolvedValue({
      data: [createMockPendingLoan()],
      total: 1,
      page: 1,
      limit: 25,
      total_pages: 1,
    });

    render(<FineractApprovalPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      // "Confirm Approval" appears in both the <h3> title and <button> inside the modal
      expect(screen.getAllByText('Confirm Approval').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls Fineract approve API on confirmation', async () => {
    mockedApi.getPendingApprovalLoans.mockResolvedValue({
      data: [createMockPendingLoan()],
      total: 1,
      page: 1,
      limit: 25,
      total_pages: 1,
    });
    mockedApi.approveFineractLoan.mockResolvedValue({
      success: true,
      resourceId: 102,
      loanId: 102,
      message: 'Loan approved successfully',
    });

    render(<FineractApprovalPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(screen.getAllByText('Confirm Approval').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirm Approval/ }));

    await waitFor(() => {
      expect(mockedApi.approveFineractLoan).toHaveBeenCalledWith(
        'loan-pending-uuid',
        expect.objectContaining({
          approvedOnDate: expect.any(String),
        })
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
      expect(screen.getByText(/No loans pending approval/)).toBeInTheDocument();
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
