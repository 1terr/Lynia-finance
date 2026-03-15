import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { renderWithProviders } from '@/test/helpers';
import { RecordPaymentForm } from '@/components/payments/RecordPaymentForm';

jest.mock('@/lib/api/payments', () => ({
  recordManualPayment: jest.fn(),
  getPayments: jest.fn().mockResolvedValue({ data: [] }),
}));
jest.mock('@/hooks/use-mutation-with-toast', () => ({
  useMutationWithToast: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
  })),
}));
jest.mock('@/hooks/use-debounced-value', () => ({
  useDebouncedValue: (val: string) => val,
}));
jest.mock('@lynia/utils', () => ({
  formatCurrency: (n: number) => `$${n.toFixed(2)}`,
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('RecordPaymentForm', () => {
  const defaultProps = {
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form with heading "Record Manual Payment"', () => {
    renderWithProviders(<RecordPaymentForm {...defaultProps} />);

    expect(
      screen.getByRole('heading', { name: /record manual payment/i })
    ).toBeInTheDocument();
  });

  it('renders all required form fields', () => {
    renderWithProviders(<RecordPaymentForm {...defaultProps} />);

    expect(screen.getByLabelText(/loan id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/customer id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payment date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payment type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reference number/i)).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    renderWithProviders(<RecordPaymentForm {...defaultProps} />);

    const form = screen.getByRole('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('renders payment method dropdown with options', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecordPaymentForm {...defaultProps} />);

    const methodSelect = screen.getByLabelText(/payment method/i);
    await user.click(methodSelect);

    await waitFor(() => {
      expect(screen.getByText(/ecocash/i)).toBeInTheDocument();
      expect(screen.getByText(/onemoney/i)).toBeInTheDocument();
      expect(screen.getByText(/bank transfer/i)).toBeInTheDocument();
      expect(screen.getByText(/cash/i)).toBeInTheDocument();
    });
  });

  it('renders payment type dropdown with options', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecordPaymentForm {...defaultProps} />);

    const typeSelect = screen.getByLabelText(/payment type/i);
    await user.click(typeSelect);

    await waitFor(() => {
      expect(
        screen.getAllByRole('option').length
      ).toBeGreaterThan(0);
    });
  });

  it('shows close button that calls onClose', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecordPaymentForm {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: /close|cancel/i });
    await user.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('passes axe accessibility checks', async () => {
    const { container } = renderWithProviders(
      <RecordPaymentForm {...defaultProps} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
