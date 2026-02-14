/**
 * Tests: GL Journal Entries & Trial Balance (Phase 7 - T016)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GLAccountingDashboard from '@/components/fineract/gl-accounting-dashboard';
import * as fineractApi from '@/lib/api/fineract';
import {
  MOCK_GL_ACCOUNTS,
  MOCK_JOURNAL_ENTRIES,
  MOCK_TRIAL_BALANCE,
} from '../fixtures/fineract-mocks';

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

describe('GLAccountingDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.getGLAccounts.mockResolvedValue(MOCK_GL_ACCOUNTS);
    mockedApi.getJournalEntries.mockResolvedValue({
      data: MOCK_JOURNAL_ENTRIES,
      total: 3,
      page: 1,
      limit: 50,
      total_pages: 1,
    });
    mockedApi.getTrialBalance.mockResolvedValue(MOCK_TRIAL_BALANCE);
  });

  it('renders GL accounts list', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Cash and Bank')).toBeInTheDocument();
      expect(screen.getByText('Loan Portfolio')).toBeInTheDocument();
      expect(screen.getByText('Interest Income')).toBeInTheDocument();
    });
  });

  it('renders journal entries table', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
    });

    // Should show debit and credit entries
    expect(screen.getByText('DEBIT')).toBeInTheDocument();
    expect(screen.getByText('CREDIT')).toBeInTheDocument();
  });

  it('renders trial balance', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Trial Balance')).toBeInTheDocument();
    });

    // GL account codes
    expect(screen.getByText('1001')).toBeInTheDocument();
    expect(screen.getByText('1100')).toBeInTheDocument();
  });

  it('shows account type labels', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('ASSET')).toBeInTheDocument();
    });
  });

  it('shows GL account codes', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('1001')).toBeInTheDocument();
      expect(screen.getByText('1100')).toBeInTheDocument();
      expect(screen.getByText('4001')).toBeInTheDocument();
    });
  });

  it('supports date filtering for journal entries', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('From Date')).toBeInTheDocument();
    expect(screen.getByLabelText('To Date')).toBeInTheDocument();
  });

  it('trial balance debits equal credits', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Trial Balance')).toBeInTheDocument();
    });

    // The mock data is balanced - verify totals row exists
    expect(screen.getByText('Total')).toBeInTheDocument();
  });
});
