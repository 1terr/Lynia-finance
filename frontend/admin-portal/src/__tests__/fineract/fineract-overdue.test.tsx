/**
 * Tests: Overdue Loans & Aging Analysis (Phase 7 - T018)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OverdueLoansPage from '@/components/fineract/overdue-loans-page';
import * as fineractApi from '@/lib/api/fineract';
import {
  createMockOverdueLoan,
  MOCK_AGING_SUMMARY,
} from '../fixtures/fineract-mocks';

jest.mock('@/lib/api/fineract');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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

describe('OverdueLoansPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders aging summary buckets', async () => {
    mockedApi.getAgingSummary.mockResolvedValue(MOCK_AGING_SUMMARY);
    mockedApi.getOverdueLoans.mockResolvedValue({
      data: [createMockOverdueLoan()],
      total: 1,
      page: 1,
      limit: 25,
      total_pages: 1,
    });

    render(<OverdueLoansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('1-30 Days')).toBeInTheDocument();
      expect(screen.getByText('31-60 Days')).toBeInTheDocument();
      expect(screen.getByText('61-90 Days')).toBeInTheDocument();
      expect(screen.getByText('90+ Days')).toBeInTheDocument();
    });
  });

  it('shows total overdue amount', async () => {
    mockedApi.getAgingSummary.mockResolvedValue(MOCK_AGING_SUMMARY);
    mockedApi.getOverdueLoans.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      total_pages: 0,
    });

    render(<OverdueLoansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/\$3,210\.00/)).toBeInTheDocument();
    });
  });

  it('shows overdue loan count per bucket', async () => {
    mockedApi.getAgingSummary.mockResolvedValue(MOCK_AGING_SUMMARY);
    mockedApi.getOverdueLoans.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      total_pages: 0,
    });

    render(<OverdueLoansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument(); // 1-30 count
      expect(screen.getByText('4')).toBeInTheDocument(); // 31-60 count
    });
  });

  it('displays overdue loan details', async () => {
    const overdueLoan = createMockOverdueLoan({
      customerName: 'Blessing Muza',
      daysPastDue: 45,
      agingBucket: '31-60',
    });

    mockedApi.getAgingSummary.mockResolvedValue(MOCK_AGING_SUMMARY);
    mockedApi.getOverdueLoans.mockResolvedValue({
      data: [overdueLoan],
      total: 1,
      page: 1,
      limit: 25,
      total_pages: 1,
    });

    render(<OverdueLoansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Blessing Muza')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('31-60')).toBeInTheDocument();
    });
  });

  it('shows device lock status for overdue loans', async () => {
    const overdueLoan = createMockOverdueLoan({
      deviceLockStatus: 'locked',
    });

    mockedApi.getAgingSummary.mockResolvedValue(MOCK_AGING_SUMMARY);
    mockedApi.getOverdueLoans.mockResolvedValue({
      data: [overdueLoan],
      total: 1,
      page: 1,
      limit: 25,
      total_pages: 1,
    });

    render(<OverdueLoansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('locked')).toBeInTheDocument();
    });
  });

  it('shows total overdue loans count', async () => {
    mockedApi.getAgingSummary.mockResolvedValue(MOCK_AGING_SUMMARY);
    mockedApi.getOverdueLoans.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      total_pages: 0,
    });

    render(<OverdueLoansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument(); // total overdue loans
    });
  });
});
