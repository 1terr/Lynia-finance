import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { StepScanImei } from '@/components/handover/step-scan-imei';
import * as api from '@/lib/api';
import { createPendingHandover } from '@/__tests__/fixtures/factories';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  verifyImei: jest.fn(),
}));

describe('StepScanImei', () => {
  const mockHandover = createPendingHandover({
    device_model: 'Samsung Galaxy A15',
    device_imei: '123456789012345',
  });

  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders instruction text', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByText(/Verify the device IMEI/i)).toBeInTheDocument();
      expect(screen.getByText(/\*#06#/i)).toBeInTheDocument();
    });

    it('displays device information', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByText('Samsung Galaxy A15')).toBeInTheDocument();
      expect(screen.getByText('123456789012345')).toBeInTheDocument();
    });

    it('renders scan mode and manual mode toggle buttons', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByText('Scan Barcode')).toBeInTheDocument();
      expect(screen.getByText('Type Manually')).toBeInTheDocument();
    });

    it('shows info tip about IMEI location', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByText(/The IMEI is also printed on the device box/i)).toBeInTheDocument();
    });
  });

  describe('Manual Input Mode (Default)', () => {
    it('starts in manual input mode by default', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByPlaceholderText('351234567890123')).toBeInTheDocument();
    });

    it('renders IMEI input field', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const input = screen.getByPlaceholderText('351234567890123');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('maxLength', '15');
      expect(input).toHaveAttribute('inputMode', 'numeric');
    });

    it('displays character counter', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="12345"
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByText('5/15 digits entered')).toBeInTheDocument();
    });

    it('updates IMEI value on input', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const input = screen.getByPlaceholderText('351234567890123');
      await user.type(input, '123456789');

      expect(mockOnUpdate).toHaveBeenCalledWith({
        scanned_imei: '123456789',
        imei_verified: false,
      });
    });

    it('filters non-numeric characters', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const input = screen.getByPlaceholderText('351234567890123');
      await user.type(input, 'abc123xyz456');

      expect(mockOnUpdate).toHaveBeenCalledWith({
        scanned_imei: '123456',
        imei_verified: false,
      });
    });

    it('limits input to 15 digits', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const input = screen.getByPlaceholderText('351234567890123');
      await user.type(input, '12345678901234567890'); // 20 digits

      // Should only accept first 15
      expect(mockOnUpdate).toHaveBeenLastCalledWith({
        scanned_imei: '123456789012345',
        imei_verified: false,
      });
    });

    it('disables input when verified', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="123456789012345"
          verified={true}
          onUpdate={mockOnUpdate}
        />
      );

      const input = screen.getByPlaceholderText('351234567890123');
      expect(input).toBeDisabled();
    });
  });

  describe('Scan Mode', () => {
    it('switches to scan mode when Scan Barcode is clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const scanButton = screen.getByText('Scan Barcode').closest('button');
      await user.click(scanButton!);

      expect(screen.getByText(/Camera barcode scanner would activate here/i)).toBeInTheDocument();
    });

    it('shows scan simulation placeholder', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const scanButton = screen.getByText('Scan Barcode').closest('button');
      await user.click(scanButton!);

      expect(screen.getByText('Simulate successful scan')).toBeInTheDocument();
    });

    it('simulates successful scan when clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const scanButton = screen.getByText('Scan Barcode').closest('button');
      await user.click(scanButton!);

      const simulateButton = screen.getByText('Simulate successful scan');
      await user.click(simulateButton);

      expect(mockOnUpdate).toHaveBeenCalledWith({
        scanned_imei: mockHandover.device_imei,
        imei_verified: false,
      });
    });

    it('switches back to manual mode when Type Manually is clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      // First switch to scan mode
      const scanButton = screen.getByText('Scan Barcode').closest('button');
      await user.click(scanButton!);

      expect(screen.getByText(/Camera barcode scanner/i)).toBeInTheDocument();

      // Switch back to manual
      const manualButton = screen.getByText('Type Manually').closest('button');
      await user.click(manualButton!);

      expect(screen.getByPlaceholderText('351234567890123')).toBeInTheDocument();
    });
  });

  describe('Verification', () => {
    it('renders Verify IMEI button', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei=""
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByRole('button', { name: /Verify IMEI/i })).toBeInTheDocument();
    });

    it('disables verify button when IMEI is incomplete', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="12345"
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const verifyButton = screen.getByRole('button', { name: /Verify IMEI/i });
      expect(verifyButton).toBeDisabled();
    });

    it('enables verify button when IMEI has 15 digits', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="123456789012345"
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const verifyButton = screen.getByRole('button', { name: /Verify IMEI/i });
      expect(verifyButton).not.toBeDisabled();
    });

    it('calls verifyImei API when verify button is clicked', async () => {
      const user = userEvent.setup();
      (api.verifyImei as jest.Mock).mockResolvedValue({
        verified: true,
        message: 'IMEI verified successfully',
      });

      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="123456789012345"
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const verifyButton = screen.getByRole('button', { name: /Verify IMEI/i });
      await user.click(verifyButton);

      expect(api.verifyImei).toHaveBeenCalledWith(
        mockHandover.id,
        '123456789012345',
        mockHandover.device_imei
      );
    });

    it('shows "Verifying..." text during verification', async () => {
      const user = userEvent.setup();
      (api.verifyImei as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ verified: true }), 100))
      );

      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="123456789012345"
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const verifyButton = screen.getByRole('button', { name: /Verify IMEI/i });
      await user.click(verifyButton);

      expect(screen.getByText('Verifying...')).toBeInTheDocument();
    });

    it('updates state on successful verification', async () => {
      const user = userEvent.setup();
      (api.verifyImei as jest.Mock).mockResolvedValue({
        verified: true,
        message: 'Success',
      });

      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="123456789012345"
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const verifyButton = screen.getByRole('button', { name: /Verify IMEI/i });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({ imei_verified: true });
      });
    });

    it('shows error message on failed verification', async () => {
      const user = userEvent.setup();
      (api.verifyImei as jest.Mock).mockResolvedValue({
        verified: false,
        message: 'IMEI does not match',
      });

      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="999999999999999"
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const verifyButton = screen.getByRole('button', { name: /Verify IMEI/i });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('IMEI does not match')).toBeInTheDocument();
      });
    });

    it('does not update state on failed verification', async () => {
      const user = userEvent.setup();
      (api.verifyImei as jest.Mock).mockResolvedValue({
        verified: false,
        message: 'Failed',
      });

      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="123456789012345"
          verified={false}
          onUpdate={mockOnUpdate}
        />
      );

      const verifyButton = screen.getByRole('button', { name: /Verify IMEI/i });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });

      expect(mockOnUpdate).not.toHaveBeenCalledWith({ imei_verified: true });
    });
  });

  describe('Verified State', () => {
    it('shows success message when verified', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="123456789012345"
          verified={true}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByText('IMEI Verified')).toBeInTheDocument();
      expect(screen.getByText('123456789012345')).toBeInTheDocument();
    });

    it('hides verify button when verified', () => {
      render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="123456789012345"
          verified={true}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.queryByRole('button', { name: /Verify IMEI/i })).not.toBeInTheDocument();
    });

    it('shows green success indicator when verified', () => {
      const { container } = render(
        <StepScanImei
          handover={mockHandover}
          scannedImei="123456789012345"
          verified={true}
          onUpdate={mockOnUpdate}
        />
      );

      const successDiv = container.querySelector('.bg-green-50');
      expect(successDiv).toBeInTheDocument();
    });
  });
});
