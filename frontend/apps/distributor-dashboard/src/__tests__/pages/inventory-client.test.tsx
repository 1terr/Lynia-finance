import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import InventoryPage from '@/app/(dashboard)/inventory/_client';
import * as api from '@/lib/api';
import {
  createInventoryDevices,
  createInventoryDevice,
  resetFactoryCounters,
} from '@/__tests__/fixtures/factories';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  fetchInventory: jest.fn(),
}));

describe('InventoryPage', () => {
  const mockDevices = [
    createInventoryDevice({
      id: 'device_1',
      brand: 'Samsung',
      model: 'Galaxy A15',
      imei: '123456789012345',
      status: 'available',
      condition: 'new',
      retail_price: 250,
      received_at: '2026-02-01T10:00:00Z',
    }),
    createInventoryDevice({
      id: 'device_2',
      brand: 'Apple',
      model: 'iPhone 12',
      imei: '987654321098765',
      status: 'reserved',
      condition: 'refurbished',
      retail_price: 450,
      received_at: '2026-02-10T10:00:00Z',
    }),
    createInventoryDevice({
      id: 'device_3',
      brand: 'Samsung',
      model: 'Galaxy S21',
      imei: '555666777888999',
      status: 'assigned',
      condition: 'new',
      retail_price: 600,
      received_at: '2026-02-15T10:00:00Z',
    }),
  ];

  beforeEach(() => {
    resetFactoryCounters();
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading skeleton while fetching inventory', () => {
      (api.fetchInventory as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<InventoryPage />);

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Page Header', () => {
    beforeEach(() => {
      (api.fetchInventory as jest.Mock).mockResolvedValue(mockDevices);
    });

    it('renders page title', async () => {
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Device Inventory/i })).toBeInTheDocument();
      });
    });

    it('displays device count', async () => {
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText('3 devices assigned to you')).toBeInTheDocument();
      });
    });
  });

  describe('Status Summary Stats', () => {
    beforeEach(() => {
      (api.fetchInventory as jest.Mock).mockResolvedValue(mockDevices);
    });

    it('displays count for each status', async () => {
      render(<InventoryPage />);

      await waitFor(() => {
        // available: 1, reserved: 1, assigned: 1, sold: 0, damaged: 0
        const availableLabels = screen.getAllByText('Available');
        expect(availableLabels.length).toBeGreaterThan(0);
        const reservedLabels = screen.getAllByText('Reserved');
        expect(reservedLabels.length).toBeGreaterThan(0);
        const assignedLabels = screen.getAllByText('Assigned');
        expect(assignedLabels.length).toBeGreaterThan(0);
        expect(screen.getByText('Sold')).toBeInTheDocument();
        expect(screen.getByText('Damaged')).toBeInTheDocument();
      });
    });

    it('shows zero counts for statuses with no devices', async () => {
      render(<InventoryPage />);

      await waitFor(() => {
        const allText = screen.getByText(/Sold/i).closest('button')?.textContent;
        expect(allText).toContain('0');
      });
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      (api.fetchInventory as jest.Mock).mockResolvedValue(mockDevices);
    });

    it('renders search input', async () => {
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search by model, brand, or IMEI/i)).toBeInTheDocument();
      });
    });

    it('filters devices by model', async () => {
      const user = userEvent.setup();
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by model, brand, or IMEI/i);
      await user.type(searchInput, 'iPhone');

      await waitFor(() => {
        expect(screen.getByText(/Apple iPhone 12/i)).toBeInTheDocument();
        expect(screen.queryByText(/Samsung Galaxy A15/i)).not.toBeInTheDocument();
      });
    });

    it('filters devices by brand', async () => {
      const user = userEvent.setup();
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Apple iPhone 12/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by model, brand, or IMEI/i);
      await user.type(searchInput, 'Samsung');

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
        expect(screen.getByText(/Samsung Galaxy S21/i)).toBeInTheDocument();
        expect(screen.queryByText(/Apple iPhone 12/i)).not.toBeInTheDocument();
      });
    });

    it('filters devices by IMEI', async () => {
      const user = userEvent.setup();
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by model, brand, or IMEI/i);
      await user.type(searchInput, '123456789');

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
        expect(screen.queryByText(/Apple iPhone 12/i)).not.toBeInTheDocument();
      });
    });

    it('shows empty state when search returns no results', async () => {
      const user = userEvent.setup();
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by model, brand, or IMEI/i);
      await user.type(searchInput, 'NonexistentDevice');

      await waitFor(() => {
        expect(screen.getByText(/No devices match your search criteria/i)).toBeInTheDocument();
      });
    });

    it('search is case insensitive', async () => {
      const user = userEvent.setup();
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by model, brand, or IMEI/i);
      await user.type(searchInput, 'SAMSUNG');

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
      });
    });
  });

  describe('Status Filtering', () => {
    beforeEach(() => {
      (api.fetchInventory as jest.Mock).mockResolvedValue(mockDevices);
    });

    it('filters devices by available status', async () => {
      const user = userEvent.setup();
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
      });

      const availableButtons = screen.getAllByText('Available');
      const summaryButton = availableButtons[0].closest('button');
      await user.click(summaryButton!);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
        expect(screen.queryByText(/Apple iPhone 12/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Samsung Galaxy S21/i)).not.toBeInTheDocument();
      });
    });

    it('filters devices by reserved status', async () => {
      const user = userEvent.setup();
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Apple iPhone 12/i)).toBeInTheDocument();
      });

      const reservedButtons = screen.getAllByText('Reserved');
      const summaryButton = reservedButtons[0].closest('button');
      await user.click(summaryButton!);

      await waitFor(() => {
        expect(screen.getByText(/Apple iPhone 12/i)).toBeInTheDocument();
        expect(screen.queryByText(/Samsung Galaxy A15/i)).not.toBeInTheDocument();
      });
    });

    it('shows clear filter button when status filter is active', async () => {
      const user = userEvent.setup();
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
        expect(screen.queryByText(/Clear filter/i)).not.toBeInTheDocument();
      });

      const availableButtons = screen.getAllByText('Available');
      const summaryButton = availableButtons[0].closest('button');
      await user.click(summaryButton!);

      await waitFor(() => {
        expect(screen.getByText(/Clear filter: Available/i)).toBeInTheDocument();
      });
    });

    it('clears filter when clear filter button is clicked', async () => {
      const user = userEvent.setup();
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
      });

      const availableButtons = screen.getAllByText('Available');
      const summaryButton = availableButtons[0].closest('button');
      await user.click(summaryButton!);

      await waitFor(() => {
        expect(screen.queryByText(/Apple iPhone 12/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Clear filter: Available/i)).toBeInTheDocument();
      });

      const clearButton = screen.getByText(/Clear filter: Available/i);
      await user.click(clearButton);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
        expect(screen.getByText(/Apple iPhone 12/i)).toBeInTheDocument();
        expect(screen.getByText(/Samsung Galaxy S21/i)).toBeInTheDocument();
      });
    });

    it('toggles filter off when clicking same status button twice', async () => {
      const user = userEvent.setup();
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
      });

      const availableButtons = screen.getAllByText('Available');
      const summaryButton = availableButtons[0].closest('button');
      await user.click(summaryButton!);

      await waitFor(() => {
        expect(screen.queryByText(/Apple iPhone 12/i)).not.toBeInTheDocument();
      });

      await user.click(summaryButton!);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
        expect(screen.getByText(/Apple iPhone 12/i)).toBeInTheDocument();
      });
    });
  });

  describe('Device List Display', () => {
    beforeEach(() => {
      (api.fetchInventory as jest.Mock).mockResolvedValue(mockDevices);
    });

    it('displays device brand and model', async () => {
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
        expect(screen.getByText(/Apple iPhone 12/i)).toBeInTheDocument();
        expect(screen.getByText(/Samsung Galaxy S21/i)).toBeInTheDocument();
      });
    });

    it('displays device IMEI', async () => {
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/IMEI: 123456789012345/i)).toBeInTheDocument();
        expect(screen.getByText(/IMEI: 987654321098765/i)).toBeInTheDocument();
      });
    });

    it('displays device retail price', async () => {
      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText('$250.00')).toBeInTheDocument();
        expect(screen.getByText('$450.00')).toBeInTheDocument();
        expect(screen.getByText('$600.00')).toBeInTheDocument();
      });
    });

    it('displays device condition', async () => {
      render(<InventoryPage />);

      await waitFor(() => {
        const newLabels = screen.getAllByText('New');
        expect(newLabels.length).toBeGreaterThan(0);
        expect(screen.getByText('Refurbished')).toBeInTheDocument();
      });
    });

    it('displays device status badges', async () => {
      render(<InventoryPage />);

      await waitFor(() => {
        // Get badges (excluding the summary stat buttons)
        const badges = screen.getAllByText('Available');
        expect(badges.length).toBeGreaterThan(1); // One in summary, one in card
      });
    });

    it('displays received date', async () => {
      render(<InventoryPage />);

      await waitFor(() => {
        // Dates are formatted as "Received Feb 1" or "Received 1 Feb" depending on locale
        const receivedElements = screen.getAllByText(/Received/i);
        expect(receivedElements.length).toBeGreaterThanOrEqual(3); // One for each device
        const text = receivedElements[0].textContent;
        expect(text).toMatch(/Received.*Feb/i);
      });
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no devices exist', async () => {
      (api.fetchInventory as jest.Mock).mockResolvedValue([]);

      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/No devices in your inventory/i)).toBeInTheDocument();
      });
    });

    it('shows filtered empty state when search has no results', async () => {
      const user = userEvent.setup();
      (api.fetchInventory as jest.Mock).mockResolvedValue(mockDevices);

      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by model, brand, or IMEI/i);
      await user.type(searchInput, 'xyz');

      await waitFor(() => {
        expect(screen.getByText(/No devices match your search criteria/i)).toBeInTheDocument();
      });
    });

    it('shows filtered empty state when status filter has no results', async () => {
      const user = userEvent.setup();
      const devicesWithoutSold = createInventoryDevices(2).map((d) => ({ ...d, status: 'available' as const }));
      (api.fetchInventory as jest.Mock).mockResolvedValue(devicesWithoutSold);

      render(<InventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/Device Inventory/i)).toBeInTheDocument();
        expect(screen.queryByText(/No devices match/i)).not.toBeInTheDocument();
      });

      const soldButton = screen.getByText('Sold').closest('button');
      await user.click(soldButton!);

      await waitFor(() => {
        expect(screen.getByText(/No devices match your search criteria/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('calls fetchInventory on mount', async () => {
      (api.fetchInventory as jest.Mock).mockResolvedValue(mockDevices);

      render(<InventoryPage />);

      await waitFor(() => {
        expect(api.fetchInventory).toHaveBeenCalledTimes(1);
      });
    });
  });
});
