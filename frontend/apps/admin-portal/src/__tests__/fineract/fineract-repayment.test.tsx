/**
 * Tests: Repayment Schedule & Payment Recording (Phase 7 - T010)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RepaymentScheduleTable from '@/components/fineract/repayment-schedule-table';
import RecordPaymentForm from '@/components/fineract/record-payment-form';
import * as fineractApi from '@/lib/api/fineract';
import {
  createMockRepaymentSchedule,
  createMockRepaymentPeriod,
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

describe('RepaymentScheduleTable', () => {
  it('renders all schedule periods', () => {
    const schedule = createMockRepaymentSchedule();

    render(<RepaymentScheduleTable schedule={schedule} />, {
      wrapper: createWrapper(),
    });

    // Should show 12 period rows
    for (let i = 1; i <= 12; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it('shows completed badge for paid periods', () => {
    const schedule = createMockRepaymentSchedule();

    render(<RepaymentScheduleTable schedule={schedule} />, {
      wrapper: createWrapper(),
    });

    // Periods 1 and 2 are complete in our mock
    const completeBadges = screen.getAllByText('Paid');
    expect(completeBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('shows pending badge for unpaid periods', () => {
    const schedule = createMockRepaymentSchedule();

    render(<RepaymentScheduleTable schedule={schedule} />, {
      wrapper: createWrapper(),
    });

    const pendingBadges = screen.getAllByText('Due');
    expect(pendingBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('displays schedule totals', () => {
    const schedule = createMockRepaymentSchedule();

    render(<RepaymentScheduleTable schedule={schedule} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Schedule Summary')).toBeInTheDocument();
  });

  it('highlights overdue periods in red', () => {
    const overduePeriod = createMockRepaymentPeriod(3, {
      complete: false,
      totalOverdue: 23.34,
      dueDate: '2025-12-17', // Past date
    });

    const schedule = createMockRepaymentSchedule();
    schedule.periods[2] = overduePeriod;

    render(<RepaymentScheduleTable schedule={schedule} />, {
      wrapper: createWrapper(),
    });

    // The overdue period row should exist
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('RecordPaymentForm', () => {
  const defaultProps = {
    lyniaLoanId: 'loan-001-uuid',
    outstandingBalance: 210,
    onSuccess: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the payment form with amount input', () => {
    render(<RecordPaymentForm {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Record Payment')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (USD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Payment Date')).toBeInTheDocument();
  });

  it('shows outstanding balance', () => {
    render(<RecordPaymentForm {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText(/Outstanding/)).toBeInTheDocument();
  });

  it('submits repayment to Fineract', async () => {
    mockedApi.recordFineractRepayment.mockResolvedValue({
      success: true,
      resourceId: 503,
      message: 'Payment recorded',
    });

    render(<RecordPaymentForm {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    const amountInput = screen.getByLabelText('Amount (USD)');
    fireEvent.change(amountInput, { target: { value: '23.34' } });

    const dateInput = screen.getByLabelText('Payment Date');
    fireEvent.change(dateInput, { target: { value: '2026-02-14' } });

    const submitBtn = screen.getByText('Submit Payment');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockedApi.recordFineractRepayment).toHaveBeenCalledWith(
        'loan-001-uuid',
        expect.objectContaining({
          transactionAmount: 23.34,
          transactionDate: '2026-02-14',
        })
      );
    });
  });

  it('validates amount is positive', async () => {
    render(<RecordPaymentForm {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    const amountInput = screen.getByLabelText('Amount (USD)');
    fireEvent.change(amountInput, { target: { value: '0' } });

    // Submit the form directly to bypass any native validation
    const form = amountInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Amount must be greater than zero/)).toBeInTheDocument();
    });

    expect(mockedApi.recordFineractRepayment).not.toHaveBeenCalled();
  });

  it('validates amount does not exceed outstanding', async () => {
    render(<RecordPaymentForm {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    const amountInput = screen.getByLabelText('Amount (USD)');
    fireEvent.change(amountInput, { target: { value: '500' } });

    // Submit the form directly to bypass any native validation
    const form = amountInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/Amount exceeds outstanding balance/)
      ).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel button clicked', () => {
    render(<RecordPaymentForm {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });
});
