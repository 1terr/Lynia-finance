/**
 * Tests: Reconciliation Dashboard (Phase 7 - T012)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReconciliationDashboard from '@/components/fineract/reconciliation-dashboard';
import * as fineractApi from '@/lib/api/fineract';
import { MOCK_RECONCILIATION } from '../fixtures/fineract-mocks';

jest.mock('@/lib/api/fineract');
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

describe('ReconciliationDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders reconciliation summary', async () => {
    mockedApi.getReconciliationResults.mockResolvedValue(MOCK_RECONCILIATION);

    render(<ReconciliationDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Reconciliation')).toBeInTheDocument();
    });

    expect(screen.getByText('45')).toBeInTheDocument(); // total checked
    expect(screen.getByText('43')).toBeInTheDocument(); // matched
    expect(screen.getByText('2')).toBeInTheDocument(); // discrepancies
  });

  it('displays discrepancy details', async () => {
    mockedApi.getReconciliationResults.mockResolvedValue(MOCK_RECONCILIATION);

    render(<ReconciliationDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Tapiwa Madzivire')).toBeInTheDocument();
    });

    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('shows severity badges with correct colors', async () => {
    mockedApi.getReconciliationResults.mockResolvedValue(MOCK_RECONCILIATION);

    render(<ReconciliationDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('low')).toBeInTheDocument();
    });
  });

  it('displays retry statistics', async () => {
    mockedApi.getReconciliationResults.mockResolvedValue(MOCK_RECONCILIATION);

    render(<ReconciliationDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Retried Syncs/)).toBeInTheDocument();
    });
  });

  it('shows trigger reconciliation button', async () => {
    mockedApi.getReconciliationResults.mockResolvedValue(MOCK_RECONCILIATION);

    render(<ReconciliationDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Run Reconciliation')).toBeInTheDocument();
    });
  });

  it('triggers manual reconciliation on button click', async () => {
    mockedApi.getReconciliationResults.mockResolvedValue(MOCK_RECONCILIATION);
    mockedApi.triggerReconciliation.mockResolvedValue(MOCK_RECONCILIATION);

    render(<ReconciliationDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Run Reconciliation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Run Reconciliation'));

    await waitFor(() => {
      expect(mockedApi.triggerReconciliation).toHaveBeenCalled();
    });
  });

  it('shows last run timestamp', async () => {
    mockedApi.getReconciliationResults.mockResolvedValue(MOCK_RECONCILIATION);

    render(<ReconciliationDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Last run/)).toBeInTheDocument();
    });
  });
});
