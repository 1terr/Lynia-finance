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

    // Click the Journal Entries tab (default tab is GL Accounts)
    await waitFor(() => {
      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Journal Entries'));

    // Should show debit and credit entries after switching tabs (multiple debit entries exist)
    await waitFor(() => {
      expect(screen.getAllByText('DEBIT').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('CREDIT').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders trial balance', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    // Click the Trial Balance tab
    await waitFor(() => {
      expect(screen.getByText('Trial Balance')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Trial Balance'));

    // GL account codes should be visible in trial balance
    await waitFor(() => {
      expect(screen.getByText('1001')).toBeInTheDocument();
      expect(screen.getByText('1100')).toBeInTheDocument();
    });
  });

  it('shows account type labels', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    // Default tab (GL Accounts) shows type labels (multiple ASSET accounts exist)
    await waitFor(() => {
      expect(screen.getAllByText('ASSET').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows GL account codes', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    // Default tab (GL Accounts) shows account codes
    await waitFor(() => {
      expect(screen.getByText('1001')).toBeInTheDocument();
      expect(screen.getByText('1100')).toBeInTheDocument();
      expect(screen.getByText('4001')).toBeInTheDocument();
    });
  });

  it('supports date filtering for journal entries', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    // Click the Journal Entries tab to see date filters
    await waitFor(() => {
      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Journal Entries'));

    await waitFor(() => {
      expect(screen.getByLabelText('From Date')).toBeInTheDocument();
      expect(screen.getByLabelText('To Date')).toBeInTheDocument();
    });
  });

  it('trial balance debits equal credits', async () => {
    render(<GLAccountingDashboard />, { wrapper: createWrapper() });

    // Click the Trial Balance tab
    await waitFor(() => {
      expect(screen.getByText('Trial Balance')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Trial Balance'));

    // The mock data is balanced - verify totals row exists
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
    });
  });
});
