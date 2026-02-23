import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { StepConfirm } from '@/components/handover/step-confirm';
import * as api from '@/lib/api';
import { createHandoverData } from '@/__tests__/fixtures/factories';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  verifyDepositPayment: jest.fn(),
}));

describe('StepConfirm', () => {
  const mockHandoverData = createHandoverData({
    identity_verified: true,
    imei_verified: true,
    signature_data_url: 'data:image/png;base64,signature',
    scanned_imei: '123456789012345',
    customer_national_id: '63-1234567A89',
    device_photos: ['photo1', 'photo2', 'photo3'],
    app_installed: true,
    app_configured: true,
    lock_test_passed: true,
    deposit_verified: false,
  });

  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders instruction text', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/Review all details below and verify the deposit payment/i)).toBeInTheDocument();
    });

    it('renders Handover Checklist section', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('HANDOVER CHECKLIST')).toBeInTheDocument();
    });

    it('renders Handover Details section', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('HANDOVER DETAILS')).toBeInTheDocument();
    });

    it('renders Deposit Payment section', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('DEPOSIT PAYMENT')).toBeInTheDocument();
    });
  });

  describe('Handover Checklist', () => {
    it('shows customer name check', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const customerName = mockHandoverData.selected_handover!.customer_name;
      expect(screen.getByText(new RegExp(`Customer: ${customerName}`, 'i'))).toBeInTheDocument();
    });

    it('shows identity verification status', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(new RegExp(mockHandoverData.customer_national_id, 'i'))).toBeInTheDocument();
    });

    it('shows IMEI verification status', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(new RegExp(mockHandoverData.scanned_imei, 'i'))).toBeInTheDocument();
    });

    it('shows device condition check', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('Device condition recorded')).toBeInTheDocument();
    });

    it('shows app installed check', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/Lynia app installed/i)).toBeInTheDocument();
    });

    it('shows remote lock test check', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('Remote lock test passed')).toBeInTheDocument();
    });

    it('shows photos captured count', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('3 photos captured')).toBeInTheDocument();
    });

    it('shows signature obtained check', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('Customer signature obtained')).toBeInTheDocument();
    });
  });

  describe('Handover Details', () => {
    it('displays customer name', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const customerName = mockHandoverData.selected_handover!.customer_name;
      const customerLabels = screen.getAllByText(customerName);
      expect(customerLabels.length).toBeGreaterThan(0);
    });

    it('displays device model', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const deviceModel = mockHandoverData.selected_handover!.device_model;
      expect(screen.getByText(deviceModel)).toBeInTheDocument();
    });

    it('displays IMEI', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const imeiMatches = screen.getAllByText(mockHandoverData.scanned_imei);
      expect(imeiMatches.length).toBeGreaterThan(0);
    });

    it('displays device condition', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const screenCondition = mockHandoverData.device_condition.screen_condition;
      const bodyCondition = mockHandoverData.device_condition.body_condition;
      expect(screen.getByText(new RegExp(`Screen: ${screenCondition}`, 'i'))).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`Body: ${bodyCondition}`, 'i'))).toBeInTheDocument();
    });

    it('displays photos count', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const photoMatches = screen.getAllByText('3 captured');
      expect(photoMatches.length).toBeGreaterThan(0);
    });

    it('displays signature status', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('Captured')).toBeInTheDocument();
    });

    it('displays loan ID', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const loanId = mockHandoverData.selected_handover!.loan_id;
      expect(screen.getByText(loanId)).toBeInTheDocument();
    });

    it('displays loan amount', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const loanAmount = mockHandoverData.selected_handover!.loan_amount;
      expect(screen.getByText(`$${loanAmount}`)).toBeInTheDocument();
    });
  });

  describe('Deposit Payment (Pre-paid)', () => {
    it('shows verified badge when deposit already paid', () => {
      const dataPrepaid = createHandoverData({
        selected_handover: {
          ...mockHandoverData.selected_handover!,
          deposit_paid: true,
        },
      });

      render(<StepConfirm data={dataPrepaid} onUpdate={mockOnUpdate} />);

      const verifiedBadges = screen.getAllByText('Verified');
      expect(verifiedBadges.length).toBeGreaterThan(0);
    });

    it('shows pre-paid message when deposit already paid', () => {
      const dataPrepaid = createHandoverData({
        selected_handover: {
          ...mockHandoverData.selected_handover!,
          deposit_paid: true,
        },
      });

      render(<StepConfirm data={dataPrepaid} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/Pre-paid via mobile money/i)).toBeInTheDocument();
    });

    it('hides payment method selection when deposit already paid', () => {
      const dataPrepaid = createHandoverData({
        selected_handover: {
          ...mockHandoverData.selected_handover!,
          deposit_paid: true,
        },
      });

      render(<StepConfirm data={dataPrepaid} onUpdate={mockOnUpdate} />);

      expect(screen.queryByText('Payment Method')).not.toBeInTheDocument();
    });
  });

  describe('Deposit Payment (Not Pre-paid)', () => {
    it('shows deposit amount warning when not paid', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const depositAmount = mockHandoverData.selected_handover!.deposit_amount;
      expect(screen.getByText(new RegExp(`\\$${depositAmount}`, 'i'))).toBeInTheDocument();
    });

    it('renders payment method options', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('EcoCash')).toBeInTheDocument();
      expect(screen.getByText('OneMoney')).toBeInTheDocument();
      expect(screen.getByText('InnBucks')).toBeInTheDocument();
      expect(screen.getByText('OneWallet')).toBeInTheDocument();
    });

    it('selects payment method when clicked', async () => {
      const user = userEvent.setup();
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const ecocashButton = screen.getByText('EcoCash').closest('button');
      await user.click(ecocashButton!);

      expect(mockOnUpdate).toHaveBeenCalledWith({ deposit_payment_method: 'ecocash' });
    });

    it('renders transaction reference input', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      expect(screen.getByPlaceholderText(/MP240207/i)).toBeInTheDocument();
    });

    it('updates transaction reference on input', async () => {
      const user = userEvent.setup();
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const input = screen.getByPlaceholderText(/MP240207/i);
      await user.type(input, 'MP240223.1234.A56789');

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ deposit_transaction_ref: expect.stringContaining('MP240223') })
      );
    });

    it('renders verify button', () => {
      render(<StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />);

      const depositAmount = mockHandoverData.selected_handover!.deposit_amount;
      expect(screen.getByRole('button', { name: new RegExp(`Verify \\$${depositAmount} Deposit`, 'i') })).toBeInTheDocument();
    });

    it('disables verify button when transaction ref is too short', () => {
      const dataShortRef = createHandoverData({
        ...mockHandoverData,
        deposit_transaction_ref: 'MP',
      });

      render(<StepConfirm data={dataShortRef} onUpdate={mockOnUpdate} />);

      const depositAmount = dataShortRef.selected_handover!.deposit_amount;
      const verifyButton = screen.getByRole('button', { name: new RegExp(`Verify \\$${depositAmount} Deposit`, 'i') });
      expect(verifyButton).toBeDisabled();
    });

    it('enables verify button when transaction ref is valid', () => {
      const dataValidRef = createHandoverData({
        ...mockHandoverData,
        deposit_transaction_ref: 'MP240223.1234.A56789',
      });

      render(<StepConfirm data={dataValidRef} onUpdate={mockOnUpdate} />);

      const depositAmount = dataValidRef.selected_handover!.deposit_amount;
      const verifyButton = screen.getByRole('button', { name: new RegExp(`Verify \\$${depositAmount} Deposit`, 'i') });
      expect(verifyButton).not.toBeDisabled();
    });
  });

  describe('Deposit Verification', () => {
    const dataWithValidRef = createHandoverData({
      ...mockHandoverData,
      deposit_transaction_ref: 'MP240223.1234.A56789',
      deposit_payment_method: 'ecocash',
    });

    it('calls verifyDepositPayment API when verify button clicked', async () => {
      const user = userEvent.setup();
      (api.verifyDepositPayment as jest.Mock).mockResolvedValue({ verified: true });

      render(<StepConfirm data={dataWithValidRef} onUpdate={mockOnUpdate} />);

      const depositAmount = dataWithValidRef.selected_handover!.deposit_amount;
      const verifyButton = screen.getByRole('button', { name: new RegExp(`Verify \\$${depositAmount} Deposit`, 'i') });
      await user.click(verifyButton);

      expect(api.verifyDepositPayment).toHaveBeenCalledWith(
        dataWithValidRef.handover_id,
        'ecocash',
        'MP240223.1234.A56789'
      );
    });

    it('shows "Verifying Payment..." during verification', async () => {
      const user = userEvent.setup();
      (api.verifyDepositPayment as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ verified: true }), 100))
      );

      render(<StepConfirm data={dataWithValidRef} onUpdate={mockOnUpdate} />);

      const depositAmount = dataWithValidRef.selected_handover!.deposit_amount;
      const verifyButton = screen.getByRole('button', { name: new RegExp(`Verify \\$${depositAmount} Deposit`, 'i') });
      await user.click(verifyButton);

      expect(screen.getByText('Verifying Payment...')).toBeInTheDocument();
    });

    it('updates state on successful verification', async () => {
      const user = userEvent.setup();
      (api.verifyDepositPayment as jest.Mock).mockResolvedValue({ verified: true });

      render(<StepConfirm data={dataWithValidRef} onUpdate={mockOnUpdate} />);

      const depositAmount = dataWithValidRef.selected_handover!.deposit_amount;
      const verifyButton = screen.getByRole('button', { name: new RegExp(`Verify \\$${depositAmount} Deposit`, 'i') });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({ deposit_verified: true });
      });
    });

    it('shows error message on failed verification', async () => {
      const user = userEvent.setup();
      (api.verifyDepositPayment as jest.Mock).mockResolvedValue({
        verified: false,
        message: 'Payment not found',
      });

      render(<StepConfirm data={dataWithValidRef} onUpdate={mockOnUpdate} />);

      const depositAmount = dataWithValidRef.selected_handover!.deposit_amount;
      const verifyButton = screen.getByRole('button', { name: new RegExp(`Verify \\$${depositAmount} Deposit`, 'i') });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Payment not found')).toBeInTheDocument();
      });
    });

    it('does not update state on failed verification', async () => {
      const user = userEvent.setup();
      (api.verifyDepositPayment as jest.Mock).mockResolvedValue({
        verified: false,
        message: 'Failed',
      });

      render(<StepConfirm data={dataWithValidRef} onUpdate={mockOnUpdate} />);

      const depositAmount = dataWithValidRef.selected_handover!.deposit_amount;
      const verifyButton = screen.getByRole('button', { name: new RegExp(`Verify \\$${depositAmount} Deposit`, 'i') });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });

      expect(mockOnUpdate).not.toHaveBeenCalledWith({ deposit_verified: true });
    });
  });

  describe('Deposit Verified State', () => {
    const dataVerified = createHandoverData({
      ...mockHandoverData,
      deposit_verified: true,
      deposit_payment_method: 'ecocash',
    });

    it('shows verified badge when deposit verified', () => {
      render(<StepConfirm data={dataVerified} onUpdate={mockOnUpdate} />);

      const verifiedBadges = screen.getAllByText('Verified');
      expect(verifiedBadges.length).toBeGreaterThan(0);
    });

    it('shows success message with payment method', () => {
      render(<StepConfirm data={dataVerified} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/Paid via ecocash/i)).toBeInTheDocument();
    });

    it('hides payment method selection when verified', () => {
      render(<StepConfirm data={dataVerified} onUpdate={mockOnUpdate} />);

      expect(screen.queryByText('Payment Method')).not.toBeInTheDocument();
    });

    it('hides verify button when verified', () => {
      render(<StepConfirm data={dataVerified} onUpdate={mockOnUpdate} />);

      const depositAmount = dataVerified.selected_handover!.deposit_amount;
      expect(screen.queryByRole('button', { name: new RegExp(`Verify \\$${depositAmount} Deposit`, 'i') })).not.toBeInTheDocument();
    });
  });
});
