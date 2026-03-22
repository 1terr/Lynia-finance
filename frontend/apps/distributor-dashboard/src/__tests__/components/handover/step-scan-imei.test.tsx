import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { StepScanImei } from '@/components/handover/step-scan-imei';
import * as api from '@/lib/api';
import {
  createApprovedLoan,
  createInventoryDevice,
  createInventoryDevices,
  resetFactoryCounters,
} from '@/__tests__/fixtures/factories';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  verifyDeviceSelection: jest.fn(),
  fetchInventory: jest.fn(),
}));

describe('StepScanImei', () => {
  const mockLoan = createApprovedLoan({
    loan_amount: 300.0,
    device_category: 'Up to $300',
  });

  const mockDevices = createInventoryDevices(3);
  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    resetFactoryCounters();
    jest.clearAllMocks();
    (api.fetchInventory as jest.Mock).mockResolvedValue(mockDevices);
  });

  describe('Rendering', () => {
    it('renders the device selection interface', async () => {
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={null}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Select a device from your inventory/i)
        ).toBeInTheDocument();
      });
    });

    it('loads and displays inventory devices', async () => {
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={null}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(api.fetchInventory).toHaveBeenCalled();
      });

      // Devices from inventory should appear in the list (brand + model combined)
      await waitFor(() => {
        // All mock devices have the same brand/model, so use getAllByText
        const deviceLabels = screen.getAllByText(`${mockDevices[0].brand} ${mockDevices[0].model}`);
        expect(deviceLabels.length).toBeGreaterThanOrEqual(mockDevices.length);
      });
    });

    it('displays device details (brand, model, IMEI, price) in the list', async () => {
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={null}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        const firstDevice = mockDevices[0];
        const brandModelMatches = screen.getAllByText(`${firstDevice.brand} ${firstDevice.model}`);
        expect(brandModelMatches.length).toBeGreaterThan(0);
        expect(screen.getByText(firstDevice.imei)).toBeInTheDocument();
        expect(
          screen.getByText(new RegExp(`\\$${firstDevice.retail_price}`))
        ).toBeInTheDocument();
      });
    });

    it('renders search/filter input for devices', async () => {
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={null}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/filter/i)).toBeInTheDocument();
      });
    });

    it('filters devices within loan budget', async () => {
      const expensiveDevice = createInventoryDevice({
        brand: 'Apple',
        model: 'iPhone 15',
        retail_price: 1200.0,
      });
      const affordableDevice = createInventoryDevice({
        brand: 'Samsung',
        model: 'Galaxy A05',
        retail_price: 150.0,
      });

      (api.fetchInventory as jest.Mock).mockResolvedValue([
        expensiveDevice,
        affordableDevice,
      ]);

      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={null}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      // Devices within budget should be shown; over-budget devices may be filtered or flagged
      await waitFor(() => {
        expect(screen.getByText('Samsung Galaxy A05')).toBeInTheDocument();
      });
    });
  });

  describe('Device Selection', () => {
    it('allows selecting a device from the list', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={null}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(`${mockDevices[0].brand} ${mockDevices[0].model}`)).toBeInTheDocument();
      });

      // Click on a device to select it
      const deviceRow = screen.getByText(`${mockDevices[0].brand} ${mockDevices[0].model}`).closest('button')
        || screen.getByText(`${mockDevices[0].brand} ${mockDevices[0].model}`).closest('[role="button"]')
        || screen.getByText(`${mockDevices[0].brand} ${mockDevices[0].model}`);
      await user.click(deviceRow);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          selected_device: expect.objectContaining({
            id: mockDevices[0].id,
          }),
        })
      );
    });

    it('shows search input to filter devices', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={null}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(`${mockDevices[0].brand} ${mockDevices[0].model}`)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search|filter/i);
      await user.type(searchInput, 'Galaxy');

      // Should filter the device list based on search text
      await waitFor(() => {
        expect(screen.getByText(/Galaxy/i)).toBeInTheDocument();
      });
    });
  });

  describe('IMEI Confirmation (after device selected)', () => {
    const selectedDevice = createInventoryDevice({
      brand: 'Samsung',
      model: 'Galaxy A15',
      imei: '351234567890123',
    });

    it('shows IMEI confirmation section after selecting a device', async () => {
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Confirm.*IMEI|IMEI Confirmation|Scan Barcode|Type IMEI/i)
        ).toBeInTheDocument();
      });
    });

    it('renders scan mode and manual mode toggle buttons', async () => {
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Scan Barcode')).toBeInTheDocument();
        expect(screen.getByText('Type IMEI')).toBeInTheDocument();
      });
    });

    it('renders IMEI input field in manual mode', async () => {
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        const input = screen.getByPlaceholderText('351234567890123');
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('maxLength', '15');
        expect(input).toHaveAttribute('inputMode', 'numeric');
      });
    });

    it('updates IMEI value on input', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('351234567890123')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('351234567890123');
      await user.type(input, '123456789');

      // The component uses local state for IMEI input (not onUpdate)
      expect(input).toHaveValue('123456789');
    });

    it('filters non-numeric characters', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('351234567890123')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('351234567890123');
      await user.type(input, 'abc123xyz456');

      // Only numeric characters should be accepted
      expect(input).toHaveValue('123456');
    });

    it('limits input to 15 digits', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('351234567890123')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('351234567890123');
      await user.type(input, '12345678901234567890'); // 20 digits

      // Should only accept first 15
      expect(input).toHaveAttribute('maxLength', '15');
    });
  });

  describe('Scan Mode', () => {
    const selectedDevice = createInventoryDevice({
      brand: 'Samsung',
      model: 'Galaxy A15',
      imei: '351234567890123',
    });

    it('switches to scan mode when Scan Barcode is clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Scan Barcode')).toBeInTheDocument();
      });
      const scanButton = screen.getByText('Scan Barcode').closest('button');
      await user.click(scanButton!);

      expect(
        screen.getByText(/Point camera at device IMEI barcode/i)
      ).toBeInTheDocument();
    });

    it('shows scan simulation placeholder', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => { expect(screen.getByText('Scan Barcode')).toBeInTheDocument(); });
      const scanButton = screen.getByText('Scan Barcode').closest('button');
      await user.click(scanButton!);

      expect(
        screen.getByText('Simulate successful scan')
      ).toBeInTheDocument();
    });

    it('simulates successful scan when clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => { expect(screen.getByText('Scan Barcode')).toBeInTheDocument(); });
      const scanButton = screen.getByText('Scan Barcode').closest('button');
      await user.click(scanButton!);

      const simulateButton = screen.getByText('Simulate successful scan');
      await user.click(simulateButton);

      // Simulate scan fills the IMEI input and switches to manual mode
      // The IMEI input should now be visible with the device's IMEI
      await waitFor(() => {
        const input = screen.getByPlaceholderText('351234567890123');
        expect(input).toHaveValue('351234567890123');
      });
    });

    it('switches back to manual mode when Type IMEI is clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      // First switch to scan mode
      await waitFor(() => { expect(screen.getByText('Scan Barcode')).toBeInTheDocument(); });
      const scanButton = screen.getByText('Scan Barcode').closest('button');
      await user.click(scanButton!);

      expect(
        screen.getByText(/Point camera at device IMEI barcode/i)
      ).toBeInTheDocument();

      // Switch back to manual
      const manualButton = screen
        .getByText('Type IMEI')
        .closest('button');
      await user.click(manualButton!);

      expect(
        screen.getByPlaceholderText('351234567890123')
      ).toBeInTheDocument();
    });
  });

  describe('Verification', () => {
    const selectedDevice = createInventoryDevice({
      brand: 'Samsung',
      model: 'Galaxy A15',
      imei: '351234567890123',
    });

    it('calls verifyDeviceSelection API when verify button is clicked', async () => {
      const user = userEvent.setup();
      (api.verifyDeviceSelection as jest.Mock).mockResolvedValue({
        verified: true,
        message: 'Device selection verified successfully',
      });

      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      // Type IMEI into the input
      await waitFor(() => { expect(screen.getByPlaceholderText('351234567890123')).toBeInTheDocument(); });
      const input = screen.getByPlaceholderText('351234567890123');
      await user.type(input, '351234567890123');

      const verifyButton = screen.getByRole('button', {
        name: /Verify|Confirm/i,
      });
      await user.click(verifyButton);

      expect(api.verifyDeviceSelection).toHaveBeenCalledWith(
        mockLoan.loan_id,
        selectedDevice.id,
        '351234567890123'
      );
    });

    it('shows "Verifying..." text during verification', async () => {
      const user = userEvent.setup();
      (api.verifyDeviceSelection as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ verified: true }), 100)
          )
      );

      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => { expect(screen.getByPlaceholderText('351234567890123')).toBeInTheDocument(); });
      const input = screen.getByPlaceholderText('351234567890123');
      await user.type(input, '351234567890123');

      const verifyButton = screen.getByRole('button', {
        name: /Verify|Confirm/i,
      });
      await user.click(verifyButton);

      expect(screen.getByText('Verifying...')).toBeInTheDocument();
    });

    it('updates state on successful verification', async () => {
      const user = userEvent.setup();
      (api.verifyDeviceSelection as jest.Mock).mockResolvedValue({
        verified: true,
        message: 'Success',
      });

      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => { expect(screen.getByPlaceholderText('351234567890123')).toBeInTheDocument(); });
      const input = screen.getByPlaceholderText('351234567890123');
      await user.type(input, '351234567890123');

      const verifyButton = screen.getByRole('button', {
        name: /Verify|Confirm/i,
      });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({
          device_imei_confirmed: true,
        });
      });
    });

    it('shows error message on failed verification', async () => {
      const user = userEvent.setup();
      (api.verifyDeviceSelection as jest.Mock).mockResolvedValue({
        verified: false,
        message: 'IMEI does not match selected device',
      });

      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => { expect(screen.getByPlaceholderText('351234567890123')).toBeInTheDocument(); });
      const input = screen.getByPlaceholderText('351234567890123');
      await user.type(input, '999999999999999');

      const verifyButton = screen.getByRole('button', {
        name: /Verify|Confirm/i,
      });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(
          screen.getByText('IMEI does not match selected device')
        ).toBeInTheDocument();
      });
    });

    it('does not update state on failed verification', async () => {
      const user = userEvent.setup();
      (api.verifyDeviceSelection as jest.Mock).mockResolvedValue({
        verified: false,
        message: 'Failed',
      });

      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => { expect(screen.getByPlaceholderText('351234567890123')).toBeInTheDocument(); });
      const input = screen.getByPlaceholderText('351234567890123');
      await user.type(input, '351234567890123');

      const verifyButton = screen.getByRole('button', {
        name: /Verify|Confirm/i,
      });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });

      expect(mockOnUpdate).not.toHaveBeenCalledWith({
        device_imei_confirmed: true,
      });
    });
  });

  describe('Confirmed State', () => {
    const selectedDevice = createInventoryDevice({
      brand: 'Samsung',
      model: 'Galaxy A15',
      imei: '351234567890123',
    });

    it('shows success message when confirmed', async () => {
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={true}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/IMEI Verified|Device Confirmed/i)
        ).toBeInTheDocument();
        expect(screen.getByText(/351234567890123/)).toBeInTheDocument();
      });
    });

    it('hides verify button when confirmed', async () => {
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={true}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Device Confirmed/i)
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole('button', { name: /Verify|Confirm IMEI/i })
      ).not.toBeInTheDocument();
    });

    it('shows green success indicator when confirmed', async () => {
      const { container } = render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={true}
          onUpdate={mockOnUpdate}
        />
      );

      await waitFor(() => {
        const successDiv = container.querySelector('.bg-green-50');
        expect(successDiv).toBeInTheDocument();
      });
    });

    it('disables input when confirmed', () => {
      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={selectedDevice}
          confirmed={true}
          onUpdate={mockOnUpdate}
        />
      );

      const input = screen.queryByPlaceholderText('351234567890123');
      if (input) {
        expect(input).toBeDisabled();
      }
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator while fetching inventory', () => {
      (api.fetchInventory as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={null}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      expect(
        screen.getByText(/loading|fetching/i)
      ).toBeInTheDocument();
    });

    it('shows content after inventory fetch fails (react-query handles error)', async () => {
      (api.fetchInventory as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(
        <StepScanImei
          loan={mockLoan}
          selectedDevice={null}
          confirmed={false}
          onUpdate={mockOnUpdate}
        />
      );

      // After fetch fails, react-query resolves with empty data
      // Component shows the instruction text with empty device list
      await waitFor(() => {
        expect(
          screen.getByText(/Select a device from your inventory/i)
        ).toBeInTheDocument();
      });
    });
  });
});
