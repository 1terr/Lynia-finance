/**
 * Tests: Fineract Loan Detail Page (Phase 7 - T006)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FineractLoanDetailPage from '@/components/fineract/fineract-loan-detail-page';
import * as fineractApi from '@/lib/api/fineract';
import { createMockLoanDetail } from '../fixtures/fineract-mocks';

jest.mock('@/lib/api/fineract');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useParams: () => ({ id: 'loan-001-uuid' }),
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

describe('FineractLoanDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loan header with customer name and status', async () => {
    const detail = createMockLoanDetail();
    mockedApi.getFineractLoanDetail.mockResolvedValue(detail);

    render(<FineractLoanDetailPage loanId="loan-001-uuid" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Tendai Moyo')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('displays Fineract balance summary', async () => {
    const detail = createMockLoanDetail();
    mockedApi.getFineractLoanDetail.mockResolvedValue(detail);

    render(<FineractLoanDetailPage loanId="loan-001-uuid" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Principal Outstanding')).toBeInTheDocument();
      expect(screen.getByText('Interest Outstanding')).toBeInTheDocument();
      // "Total Outstanding" appears in both BalanceCard and RepaymentScheduleTable summary
      expect(screen.getAllByText('Total Outstanding').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders repayment schedule table', async () => {
    const detail = createMockLoanDetail();
    mockedApi.getFineractLoanDetail.mockResolvedValue(detail);

    render(<FineractLoanDetailPage loanId="loan-001-uuid" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Repayment Schedule')).toBeInTheDocument();
    });

    // Schedule should have period rows
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders transaction history', async () => {
    const detail = createMockLoanDetail();
    mockedApi.getFineractLoanDetail.mockResolvedValue(detail);

    render(<FineractLoanDetailPage loanId="loan-001-uuid" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Transaction History')).toBeInTheDocument();
    });

    // Should show disbursement and repayment entries
    expect(screen.getByText('Disbursement')).toBeInTheDocument();
    expect(screen.getAllByText('Repayment').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loan timeline', async () => {
    const detail = createMockLoanDetail();
    mockedApi.getFineractLoanDetail.mockResolvedValue(detail);

    render(<FineractLoanDetailPage loanId="loan-001-uuid" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Loan Timeline')).toBeInTheDocument();
    });
  });

  it('shows device information', async () => {
    const detail = createMockLoanDetail();
    mockedApi.getFineractLoanDetail.mockResolvedValue(detail);

    render(<FineractLoanDetailPage loanId="loan-001-uuid" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Samsung Galaxy A14')).toBeInTheDocument();
    });
  });

  it('handles loan not found', async () => {
    mockedApi.getFineractLoanDetail.mockResolvedValue(null);

    render(<FineractLoanDetailPage loanId="nonexistent" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Loan not found')).toBeInTheDocument();
    });
  });
});
