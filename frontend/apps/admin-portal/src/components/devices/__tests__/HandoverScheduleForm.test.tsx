import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { HandoverScheduleForm } from '@/components/devices/HandoverScheduleForm';

describe('HandoverScheduleForm', () => {
  const defaultProps = {
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form with heading "Schedule Device Handover"', () => {
    render(<HandoverScheduleForm {...defaultProps} />);

    expect(
      screen.getByRole('heading', { name: /schedule device handover/i })
    ).toBeInTheDocument();
  });

  it('renders all required input fields', () => {
    render(<HandoverScheduleForm {...defaultProps} />);

    expect(screen.getByLabelText(/loan id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/customer id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/device id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/distributor id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/scheduled date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/scheduled time/i)).toBeInTheDocument();
  });

  it('submit button is disabled when required fields are empty', () => {
    render(<HandoverScheduleForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /schedule/i });
    expect(submitButton).toBeDisabled();
  });

  it('submit button is enabled when all required fields are filled', async () => {
    const user = userEvent.setup();
    render(<HandoverScheduleForm {...defaultProps} />);

    await user.type(screen.getByLabelText(/loan id/i), 'LOAN-001');
    await user.type(screen.getByLabelText(/customer id/i), 'CUST-001');
    await user.type(screen.getByLabelText(/device id/i), 'DEV-001');
    await user.type(screen.getByLabelText(/distributor id/i), 'DIST-001');
    await user.type(screen.getByLabelText(/scheduled date/i), '2026-04-01');
    await user.type(screen.getByLabelText(/scheduled time/i), '10:00');

    const submitButton = screen.getByRole('button', { name: /schedule/i });
    expect(submitButton).toBeEnabled();
  });

  it('calls onSubmit with form data when submitted', async () => {
    const user = userEvent.setup();
    render(<HandoverScheduleForm {...defaultProps} />);

    await user.type(screen.getByLabelText(/loan id/i), 'LOAN-001');
    await user.type(screen.getByLabelText(/customer id/i), 'CUST-001');
    await user.type(screen.getByLabelText(/device id/i), 'DEV-001');
    await user.type(screen.getByLabelText(/distributor id/i), 'DIST-001');
    await user.type(screen.getByLabelText(/scheduled date/i), '2026-04-01');
    await user.type(screen.getByLabelText(/scheduled time/i), '10:00');
    await user.type(screen.getByLabelText(/notes/i), 'Test handover');

    const submitButton = screen.getByRole('button', { name: /schedule/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          loan_id: 'LOAN-001',
          customer_id: 'CUST-001',
          device_id: 'DEV-001',
          distributor_id: 'DIST-001',
          scheduled_date: '2026-04-01',
          scheduled_time: '10:00',
          notes: 'Test handover',
        })
      );
    });
  });

  it('calls onCancel when Cancel clicked', async () => {
    const user = userEvent.setup();
    render(<HandoverScheduleForm {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('submit button is disabled when isLoading is true', async () => {
    const user = userEvent.setup();
    render(<HandoverScheduleForm {...defaultProps} isLoading />);

    await user.type(screen.getByLabelText(/loan id/i), 'LOAN-001');
    await user.type(screen.getByLabelText(/customer id/i), 'CUST-001');
    await user.type(screen.getByLabelText(/device id/i), 'DEV-001');
    await user.type(screen.getByLabelText(/distributor id/i), 'DIST-001');
    await user.type(screen.getByLabelText(/scheduled date/i), '2026-04-01');
    await user.type(screen.getByLabelText(/scheduled time/i), '10:00');

    const submitButton = screen.getByRole('button', { name: /schedule/i });
    expect(submitButton).toBeDisabled();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<HandoverScheduleForm {...defaultProps} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
