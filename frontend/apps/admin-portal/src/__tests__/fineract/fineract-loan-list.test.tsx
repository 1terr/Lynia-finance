/**
 * Tests: Fineract Loan List Page (Phase 7 - T004)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FineractLoansPage from '@/components/fineract/fineract-loans-page';
import * as fineractApi from '@/lib/api/fineract';
import { createMockLoanView, createMockPendingLoan } from '../fixtures/fineract-mocks';

// Mock the API module
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

describe('FineractLoansPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the page header', async () => {
    mockedApi.getFineractLoans.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      total_pages: 0,
    });

    render(<FineractLoansPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Loan Portfolio')).toBeInTheDocument();
    expect(
      screen.getByText(/Real-time loan portfolio data/)
    ).toBeInTheDocument();
  });

  it('displays loans from Fineract with balances', async () => {
    const loan1 = createMockLoanView();
    const loan2 = createMockPendingLoan();

    mockedApi.getFineractLoans.mockResolvedValue({
      data: [loan1, loan2],
      total: 2,
      page: 1,
      limit: 25,
      total_pages: 1,
    });

    render(<FineractLoansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Tendai Moyo')).toBeInTheDocument();
      expect(screen.getByText('Chipo Ndlovu')).toBeInTheDocument();
    });

    // Verify Fineract status badges (text appears in both dropdown options + badges)
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pending Approval').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Fineract balance columns', async () => {
    const loan = createMockLoanView();

    mockedApi.getFineractLoans.mockResolvedValue({
      data: [loan],
      total: 1,
      page: 1,
      limit: 25,
      total_pages: 1,
    });

    render(<FineractLoansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Tendai Moyo')).toBeInTheDocument();
    });

    // Verify column headers exist
    expect(screen.getByText('Outstanding')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('filters loans by Fineract status', async () => {
    mockedApi.getFineractLoans.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      total_pages: 0,
    });

    render(<FineractLoansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedApi.getFineractLoans).toHaveBeenCalledTimes(1);
    });

    // Change filter
    const statusSelect = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusSelect, {
      target: { value: 'loanStatusType.active' },
    });

    await waitFor(() => {
      expect(mockedApi.getFineractLoans).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'loanStatusType.active',
        })
      );
    });
  });

  it('supports search by customer name', async () => {
    mockedApi.getFineractLoans.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      total_pages: 0,
    });

    render(<FineractLoansPage />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(/Search by name, phone/);
    fireEvent.change(searchInput, { target: { value: 'Tendai' } });

    // Search is now debounced (300ms) - wait for it to fire
    await waitFor(() => {
      expect(mockedApi.getFineractLoans).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Tendai',
        })
      );
    }, { timeout: 1000 });
  });

  it('shows empty state when no loans', async () => {
    mockedApi.getFineractLoans.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      total_pages: 0,
    });

    render(<FineractLoansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No loans found')).toBeInTheDocument();
    });
  });

  it('shows total count from Fineract', async () => {
    mockedApi.getFineractLoans.mockResolvedValue({
      data: [createMockLoanView()],
      total: 45,
      page: 1,
      limit: 25,
      total_pages: 2,
    });

    render(<FineractLoansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/45 total loans/)).toBeInTheDocument();
    });
  });
});
