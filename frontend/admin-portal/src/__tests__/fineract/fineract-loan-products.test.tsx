/**
 * Tests: Loan Products Management Page (Phase 7 - T014)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoanProductsPage from '@/components/fineract/loan-products-page';
import * as fineractApi from '@/lib/api/fineract';
import { MOCK_LOAN_PRODUCTS } from '../fixtures/fineract-mocks';

jest.mock('@/lib/api/fineract');

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

describe('LoanProductsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all three loan product tiers', async () => {
    mockedApi.getFineractLoanProducts.mockResolvedValue(MOCK_LOAN_PRODUCTS);

    render(<LoanProductsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Tier 1/)).toBeInTheDocument();
      expect(screen.getByText(/Tier 2/)).toBeInTheDocument();
      expect(screen.getByText(/Tier 3/)).toBeInTheDocument();
    });
  });

  it('displays product details correctly', async () => {
    mockedApi.getFineractLoanProducts.mockResolvedValue(MOCK_LOAN_PRODUCTS);

    render(<LoanProductsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Interest rates
      expect(screen.getByText(/5%/)).toBeInTheDocument();
      expect(screen.getByText(/4%/)).toBeInTheDocument();
      expect(screen.getByText(/3%/)).toBeInTheDocument();
    });
  });

  it('shows credit score ranges', async () => {
    mockedApi.getFineractLoanProducts.mockResolvedValue(MOCK_LOAN_PRODUCTS);

    render(<LoanProductsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/350.*499/)).toBeInTheDocument();
      expect(screen.getByText(/500.*649/)).toBeInTheDocument();
      expect(screen.getByText(/650.*850/)).toBeInTheDocument();
    });
  });

  it('shows principal ranges', async () => {
    mockedApi.getFineractLoanProducts.mockResolvedValue(MOCK_LOAN_PRODUCTS);

    render(<LoanProductsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/\$50.*\$200/)).toBeInTheDocument();
      expect(screen.getByText(/\$200.*\$500/)).toBeInTheDocument();
      expect(screen.getByText(/\$500.*\$2,000/)).toBeInTheDocument();
    });
  });

  it('shows down payment percentages', async () => {
    mockedApi.getFineractLoanProducts.mockResolvedValue(MOCK_LOAN_PRODUCTS);

    render(<LoanProductsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/30%/)).toBeInTheDocument();
      expect(screen.getByText(/20%/)).toBeInTheDocument();
      expect(screen.getByText(/10%/)).toBeInTheDocument();
    });
  });

  it('shows accounting rule for each product', async () => {
    mockedApi.getFineractLoanProducts.mockResolvedValue(MOCK_LOAN_PRODUCTS);

    render(<LoanProductsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      const accrualLabels = screen.getAllByText(/Accrual/);
      expect(accrualLabels.length).toBe(3);
    });
  });
});
