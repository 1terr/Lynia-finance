import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';

const mockFetchPaymentSummary = jest.fn();

jest.mock('@/lib/api/payments', () => ({
  fetchPaymentSummary: (...args: unknown[]) => mockFetchPaymentSummary(...args),
}));
jest.mock('@lynia/utils', () => ({
  formatCurrency: (n: number) => `$${n.toFixed(2)}`,
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import { PaymentSummaryCards } from '@/components/payments/PaymentSummaryCards';
import { renderWithProviders } from '@/test/helpers';

const mockSummaryData = {
  total_confirmed: 1250.5,
  total_pending: 340,
  total_failed: 56.88,
  total_refunded: 0,
  count_confirmed: 22,
  count_pending: 6,
  count_failed: 1,
  count_refunded: 0,
};

describe('PaymentSummaryCards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading skeletons initially', () => {
    mockFetchPaymentSummary.mockReturnValue(new Promise(() => {}));
    const { container } = renderWithProviders(<PaymentSummaryCards />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it('renders all 4 cards with labels when data loads', async () => {
    mockFetchPaymentSummary.mockResolvedValue(mockSummaryData);
    renderWithProviders(<PaymentSummaryCards />);

    await waitFor(() => {
      expect(screen.getByText(/Confirmed/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Pending/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Refunded/i)).toBeInTheDocument();
  });

  it('shows payment counts', async () => {
    mockFetchPaymentSummary.mockResolvedValue(mockSummaryData);
    renderWithProviders(<PaymentSummaryCards />);

    await waitFor(() => {
      expect(screen.getByText('22')).toBeInTheDocument();
    });
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('passes axe accessibility checks', async () => {
    mockFetchPaymentSummary.mockResolvedValue(mockSummaryData);
    const { container } = renderWithProviders(<PaymentSummaryCards />);

    await waitFor(() => {
      expect(screen.getByText(/Confirmed/i)).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
