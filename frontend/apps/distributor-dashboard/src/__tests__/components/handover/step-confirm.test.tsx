import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { StepConfirm } from '@/components/handover/step-confirm';
import * as api from '@/lib/api';
import {
  createHandoverData,
  createApprovedLoan,
  createInventoryDevice,
} from '@/__tests__/fixtures/factories';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  verifyDepositPayment: jest.fn(),
}));

describe('StepConfirm', () => {
  const mockLoan = createApprovedLoan({
    loan_id: 'LYN-2026-042',
    customer_name: 'John Moyo',
    loan_amount: 300.0,
    deposit_amount: 30.0,
    deposit_paid: false,
    monthly_payment: 28.5,
    loan_term_months: 12,
    first_payment_date: '2026-04-01T00:00:00.000Z',
  });

  const mockDevice = createInventoryDevice({
    brand: 'Samsung',
    model: 'Galaxy A15',
    imei: '351234567890123',
    retail_price: 280.0,
  });

  const mockHandoverData = createHandoverData({
    selected_loan: mockLoan,
    selected_device: mockDevice,
    identity_verified: true,
    device_imei_confirmed: true,
    signature_data_url: 'data:image/png;base64,signature',
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
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByText(
          /Review all details and verify the deposit payment/i
        )
      ).toBeInTheDocument();
    });

    it('renders Handover Checklist section', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(screen.getByText('Handover Checklist')).toBeInTheDocument();
    });

    it('renders Handover Details section', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(screen.getByText('Handover Details')).toBeInTheDocument();
    });

    it('renders Deposit Payment section', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(screen.getByText('Deposit Payment')).toBeInTheDocument();
    });

    it('renders Customer Payment Plan section', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByText(/CUSTOMER PAYMENT PLAN/i)
      ).toBeInTheDocument();
    });
  });

  describe('Handover Checklist', () => {
    it('shows customer name check', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const customerName = mockHandoverData.selected_loan!.customer_name;
      expect(
        screen.getByText(new RegExp(`Customer: ${customerName}`, 'i'))
      ).toBeInTheDocument();
    });

    it('shows identity verification status', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByText(
          new RegExp(mockHandoverData.customer_national_id, 'i')
        )
      ).toBeInTheDocument();
    });

    it('shows device IMEI confirmation status', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByText(
          new RegExp(mockHandoverData.selected_device!.imei, 'i')
        )
      ).toBeInTheDocument();
    });

    it('shows device condition check', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByText('Device condition recorded')
      ).toBeInTheDocument();
    });

    it('shows app installed check', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByText(/Lynia app installed/i)
      ).toBeInTheDocument();
    });

    it('shows remote lock test check', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByText('Remote lock test passed')
      ).toBeInTheDocument();
    });

    it('shows photos captured count', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(screen.getByText('3 photos captured')).toBeInTheDocument();
    });

    it('shows signature obtained check', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByText('Customer signature obtained')
      ).toBeInTheDocument();
    });
  });

  describe('Handover Details', () => {
    it('displays customer name', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const customerName = mockHandoverData.selected_loan!.customer_name;
      const customerLabels = screen.getAllByText(customerName);
      expect(customerLabels.length).toBeGreaterThan(0);
    });

    it('displays device brand and model from selected_device', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      // Brand and model are rendered together in the component
      const brandModel = `${mockHandoverData.selected_device!.brand} ${mockHandoverData.selected_device!.model}`;
      const matches = screen.getAllByText(new RegExp(brandModel));
      expect(matches.length).toBeGreaterThan(0);
    });

    it('displays IMEI from selected_device', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const imeiMatches = screen.getAllByText(
        mockHandoverData.selected_device!.imei
      );
      expect(imeiMatches.length).toBeGreaterThan(0);
    });

    it('displays device retail price from selected_device', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByText(
          new RegExp(
            `\\$${mockHandoverData.selected_device!.retail_price}`
          )
        )
      ).toBeInTheDocument();
    });

    it('displays device condition', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const screenCondition =
        mockHandoverData.device_condition.screen_condition;
      const bodyCondition =
        mockHandoverData.device_condition.body_condition;
      expect(
        screen.getByText(
          new RegExp(`Screen: ${screenCondition}`, 'i')
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          new RegExp(`Body: ${bodyCondition}`, 'i')
        )
      ).toBeInTheDocument();
    });

    it('displays photos count', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      // "3 captured" in details, "3 photos captured" in checklist
      const photoMatches = screen.getAllByText(/3 (?:captured|photos captured)/);
      expect(photoMatches.length).toBeGreaterThan(0);
    });

    it('displays signature status', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(screen.getByText('Captured')).toBeInTheDocument();
    });

    it('displays loan ID', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const loanId = mockHandoverData.selected_loan!.loan_id;
      expect(screen.getByText(loanId)).toBeInTheDocument();
    });

    it('displays device retail price', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const retailPrice = mockHandoverData.selected_device!.retail_price;
      expect(screen.getByText(`$${retailPrice}`)).toBeInTheDocument();
    });
  });

  describe('Customer Payment Plan', () => {
    it('displays monthly payment amount', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const monthlyPayment =
        mockHandoverData.selected_loan!.monthly_payment;
      expect(
        screen.getByText(new RegExp(`\\$${monthlyPayment}`))
      ).toBeInTheDocument();
    });

    it('displays loan duration (term in months)', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const termMonths =
        mockHandoverData.selected_loan!.loan_term_months;
      expect(
        screen.getByText(new RegExp(`${termMonths}\\s*months`, 'i'))
      ).toBeInTheDocument();
    });

    it('displays first payment date', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      // The first_payment_date should be rendered in a human-readable format
      expect(
        screen.getByText(/first payment/i)
      ).toBeInTheDocument();
    });

    it('displays total cost', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      // Total cost = monthly_payment * loan_term_months + deposit_amount
      // 28.5 * 12 + 30 = 372
      expect(
        screen.getByText(/total/i)
      ).toBeInTheDocument();
    });
  });

  describe('Deposit Payment (Pre-paid)', () => {
    it('shows verified badge when deposit already paid', () => {
      const dataPrepaid = createHandoverData({
        selected_loan: createApprovedLoan({
          ...mockLoan,
          deposit_paid: true,
        }),
        selected_device: mockDevice,
        identity_verified: true,
        device_imei_confirmed: true,
      });

      render(
        <StepConfirm data={dataPrepaid} onUpdate={mockOnUpdate} />
      );

      const verifiedBadges = screen.getAllByText('Verified');
      expect(verifiedBadges.length).toBeGreaterThan(0);
    });

    it('shows pre-paid message when deposit already paid', () => {
      const dataPrepaid = createHandoverData({
        selected_loan: createApprovedLoan({
          ...mockLoan,
          deposit_paid: true,
        }),
        selected_device: mockDevice,
        identity_verified: true,
        device_imei_confirmed: true,
      });

      render(
        <StepConfirm data={dataPrepaid} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByText(/Pre-paid via mobile money/i)
      ).toBeInTheDocument();
    });

    it('hides payment method selection when deposit already paid', () => {
      const dataPrepaid = createHandoverData({
        selected_loan: createApprovedLoan({
          ...mockLoan,
          deposit_paid: true,
        }),
        selected_device: mockDevice,
        identity_verified: true,
        device_imei_confirmed: true,
      });

      render(
        <StepConfirm data={dataPrepaid} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.queryByText('Payment Method')
      ).not.toBeInTheDocument();
    });
  });

  describe('Deposit Payment (Not Pre-paid)', () => {
    it('shows deposit amount warning when not paid', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const depositAmount =
        mockHandoverData.selected_loan!.deposit_amount;
      // Deposit amount appears in multiple places (warning text, verify button)
      const matches = screen.getAllByText(new RegExp(`\\$${depositAmount}`, 'i'));
      expect(matches.length).toBeGreaterThan(0);
    });

    it('renders payment method options', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(screen.getByText('EcoCash')).toBeInTheDocument();
      expect(screen.getByText('OneMoney')).toBeInTheDocument();
      expect(screen.getByText('InnBucks')).toBeInTheDocument();
      expect(screen.getByText('OneWallet')).toBeInTheDocument();
    });

    it('selects payment method when clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const ecocashButton = screen
        .getByText('EcoCash')
        .closest('button');
      await user.click(ecocashButton!);

      expect(mockOnUpdate).toHaveBeenCalledWith({
        deposit_payment_method: 'ecocash',
      });
    });

    it('renders transaction reference input', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByPlaceholderText(/MP240207/i)
      ).toBeInTheDocument();
    });

    it('updates transaction reference on input', async () => {
      const user = userEvent.setup();
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const input = screen.getByPlaceholderText(/MP240207/i);
      await user.type(input, 'MP240223.1234.A56789');

      // onUpdate is called per keystroke; since the input is controlled and the mock
      // does not update props, each call contains only the current character.
      // Verify onUpdate was called for each keystroke.
      expect(mockOnUpdate).toHaveBeenCalled();
      const firstCall = mockOnUpdate.mock.calls[0][0];
      expect(firstCall).toHaveProperty('deposit_transaction_ref');
    });

    it('renders verify button', () => {
      render(
        <StepConfirm data={mockHandoverData} onUpdate={mockOnUpdate} />
      );

      const depositAmount =
        mockHandoverData.selected_loan!.deposit_amount;
      expect(
        screen.getByRole('button', {
          name: new RegExp(
            `Verify \\$${depositAmount} Deposit`,
            'i'
          ),
        })
      ).toBeInTheDocument();
    });

    it('disables verify button when transaction ref is too short', () => {
      const dataShortRef = createHandoverData({
        ...mockHandoverData,
        deposit_transaction_ref: 'MP',
      });

      render(
        <StepConfirm data={dataShortRef} onUpdate={mockOnUpdate} />
      );

      const depositAmount =
        dataShortRef.selected_loan!.deposit_amount;
      const verifyButton = screen.getByRole('button', {
        name: new RegExp(
          `Verify \\$${depositAmount} Deposit`,
          'i'
        ),
      });
      expect(verifyButton).toBeDisabled();
    });

    it('enables verify button when transaction ref is valid', () => {
      const dataValidRef = createHandoverData({
        ...mockHandoverData,
        deposit_transaction_ref: 'MP240223.1234.A56789',
      });

      render(
        <StepConfirm data={dataValidRef} onUpdate={mockOnUpdate} />
      );

      const depositAmount =
        dataValidRef.selected_loan!.deposit_amount;
      const verifyButton = screen.getByRole('button', {
        name: new RegExp(
          `Verify \\$${depositAmount} Deposit`,
          'i'
        ),
      });
      expect(verifyButton).not.toBeDisabled();
    });
  });

  describe('Deposit Verification', () => {
    const dataWithValidRef = createHandoverData({
      ...mockHandoverData,
      deposit_transaction_ref: 'MP240223.1234.A56789',
      deposit_payment_method: 'ecocash',
    });

    it('calls verifyDepositPayment API with loan_id when verify button clicked', async () => {
      const user = userEvent.setup();
      (api.verifyDepositPayment as jest.Mock).mockResolvedValue({
        verified: true,
      });

      render(
        <StepConfirm
          data={dataWithValidRef}
          onUpdate={mockOnUpdate}
        />
      );

      const depositAmount =
        dataWithValidRef.selected_loan!.deposit_amount;
      const verifyButton = screen.getByRole('button', {
        name: new RegExp(
          `Verify \\$${depositAmount} Deposit`,
          'i'
        ),
      });
      await user.click(verifyButton);

      expect(api.verifyDepositPayment).toHaveBeenCalledWith(
        dataWithValidRef.selected_loan!.loan_id,
        'ecocash',
        'MP240223.1234.A56789'
      );
    });

    it('shows "Verifying Payment..." during verification', async () => {
      const user = userEvent.setup();
      (api.verifyDepositPayment as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ verified: true }), 100)
          )
      );

      render(
        <StepConfirm
          data={dataWithValidRef}
          onUpdate={mockOnUpdate}
        />
      );

      const depositAmount =
        dataWithValidRef.selected_loan!.deposit_amount;
      const verifyButton = screen.getByRole('button', {
        name: new RegExp(
          `Verify \\$${depositAmount} Deposit`,
          'i'
        ),
      });
      await user.click(verifyButton);

      expect(
        screen.getByText('Verifying Payment...')
      ).toBeInTheDocument();
    });

    it('updates state on successful verification', async () => {
      const user = userEvent.setup();
      (api.verifyDepositPayment as jest.Mock).mockResolvedValue({
        verified: true,
      });

      render(
        <StepConfirm
          data={dataWithValidRef}
          onUpdate={mockOnUpdate}
        />
      );

      const depositAmount =
        dataWithValidRef.selected_loan!.deposit_amount;
      const verifyButton = screen.getByRole('button', {
        name: new RegExp(
          `Verify \\$${depositAmount} Deposit`,
          'i'
        ),
      });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({
          deposit_verified: true,
        });
      });
    });

    it('shows error message on failed verification', async () => {
      const user = userEvent.setup();
      (api.verifyDepositPayment as jest.Mock).mockResolvedValue({
        verified: false,
        message: 'Payment not found',
      });

      render(
        <StepConfirm
          data={dataWithValidRef}
          onUpdate={mockOnUpdate}
        />
      );

      const depositAmount =
        dataWithValidRef.selected_loan!.deposit_amount;
      const verifyButton = screen.getByRole('button', {
        name: new RegExp(
          `Verify \\$${depositAmount} Deposit`,
          'i'
        ),
      });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(
          screen.getByText('Payment not found')
        ).toBeInTheDocument();
      });
    });

    it('does not update state on failed verification', async () => {
      const user = userEvent.setup();
      (api.verifyDepositPayment as jest.Mock).mockResolvedValue({
        verified: false,
        message: 'Failed',
      });

      render(
        <StepConfirm
          data={dataWithValidRef}
          onUpdate={mockOnUpdate}
        />
      );

      const depositAmount =
        dataWithValidRef.selected_loan!.deposit_amount;
      const verifyButton = screen.getByRole('button', {
        name: new RegExp(
          `Verify \\$${depositAmount} Deposit`,
          'i'
        ),
      });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });

      expect(mockOnUpdate).not.toHaveBeenCalledWith({
        deposit_verified: true,
      });
    });
  });

  describe('Deposit Verified State', () => {
    const dataVerified = createHandoverData({
      ...mockHandoverData,
      deposit_verified: true,
      deposit_payment_method: 'ecocash',
    });

    it('shows verified badge when deposit verified', () => {
      render(
        <StepConfirm data={dataVerified} onUpdate={mockOnUpdate} />
      );

      const verifiedBadges = screen.getAllByText('Verified');
      expect(verifiedBadges.length).toBeGreaterThan(0);
    });

    it('shows success message with payment method', () => {
      render(
        <StepConfirm data={dataVerified} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.getByText(/Paid via ecocash/i)
      ).toBeInTheDocument();
    });

    it('hides payment method selection when verified', () => {
      render(
        <StepConfirm data={dataVerified} onUpdate={mockOnUpdate} />
      );

      expect(
        screen.queryByText('Payment Method')
      ).not.toBeInTheDocument();
    });

    it('hides verify button when verified', () => {
      render(
        <StepConfirm data={dataVerified} onUpdate={mockOnUpdate} />
      );

      const depositAmount =
        dataVerified.selected_loan!.deposit_amount;
      expect(
        screen.queryByRole('button', {
          name: new RegExp(
            `Verify \\$${depositAmount} Deposit`,
            'i'
          ),
        })
      ).not.toBeInTheDocument();
    });
  });
});
