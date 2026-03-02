import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import HandoversPage from '@/app/(dashboard)/handovers/_client';
import * as api from '@/lib/api';
import {
  createCompletedHandover,
  createCompletedHandovers,
  resetFactoryCounters,
} from '@/__tests__/fixtures/factories';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  fetchCompletedHandovers: jest.fn(),
}));

// Mock the HandoverWizard component
jest.mock('@/components/handover/handover-wizard', () => ({
  HandoverWizard: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="handover-wizard">
      <h2>Handover Wizard Mock</h2>
      <button onClick={onComplete}>Complete Handover</button>
    </div>
  ),
}));

describe('HandoversPage', () => {
  const mockCompletedHandovers = [
    createCompletedHandover({
      id: 'handover_1',
      customer_name: 'John Doe',
      device_model: 'Samsung Galaxy A15',
      loan_id: 'LOAN-001',
      loan_amount: 500,
      commission_earned: 25.0,
      completed_at: '2026-02-25T10:00:00Z',
    }),
    createCompletedHandover({
      id: 'handover_2',
      customer_name: 'Jane Smith',
      device_model: 'iPhone 12',
      loan_id: 'LOAN-002',
      loan_amount: 750,
      commission_earned: 37.5,
      completed_at: '2026-02-20T14:00:00Z',
    }),
    createCompletedHandover({
      id: 'handover_3',
      customer_name: 'Bob Johnson',
      device_model: 'Samsung Galaxy S21',
      loan_id: 'LOAN-003',
      loan_amount: 600,
      commission_earned: 30.0,
      completed_at: '2026-02-15T10:00:00Z',
    }),
  ];

  beforeEach(() => {
    resetFactoryCounters();
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading skeleton while fetching handovers', () => {
      (api.fetchCompletedHandovers as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<HandoversPage />);

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Page Header', () => {
    beforeEach(() => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockCompletedHandovers);
    });

    it('renders page title and description', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Device Handovers/i })).toBeInTheDocument();
        expect(screen.getByText(/Hand over devices to approved customers/i)).toBeInTheDocument();
      });
    });

    it('renders "Start Handover" button', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Handover/i })).toBeInTheDocument();
      });
    });
  });

  describe('Stats Cards', () => {
    beforeEach(() => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockCompletedHandovers);
    });

    it('displays completed handovers count', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
        // 3 completed handovers, but the count also appears in Devices stat
        const threes = screen.getAllByText('3');
        expect(threes.length).toBeGreaterThan(0);
      });
    });

    it('displays total earned commission', async () => {
      render(<HandoversPage />);

      // Total commission: 25 + 37.5 + 30 = 92.50
      await waitFor(() => {
        expect(screen.getByText('Earned')).toBeInTheDocument();
        expect(screen.getByText('$92.50')).toBeInTheDocument();
      });
    });

    it('displays devices count', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('Devices')).toBeInTheDocument();
      });
    });

    it('displays zero counts and $0.00 commission when no handovers', async () => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue([]);

      render(<HandoversPage />);

      await waitFor(() => {
        const zeroCounts = screen.getAllByText('0');
        expect(zeroCounts.length).toBeGreaterThanOrEqual(2); // Completed and Devices
        expect(screen.getByText('$0.00')).toBeInTheDocument();
      });
    });
  });

  describe('Completed Handovers List', () => {
    beforeEach(() => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockCompletedHandovers);
    });

    it('renders section header with completed count', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('Completed Handovers (3)')).toBeInTheDocument();
      });
    });

    it('displays customer names', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });
    });

    it('displays device models and loan IDs', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/)).toBeInTheDocument();
        expect(screen.getByText(/iPhone 12/)).toBeInTheDocument();
        expect(screen.getByText(/Samsung Galaxy S21/)).toBeInTheDocument();
        expect(screen.getByText(/LOAN-001/)).toBeInTheDocument();
        expect(screen.getByText(/LOAN-002/)).toBeInTheDocument();
        expect(screen.getByText(/LOAN-003/)).toBeInTheDocument();
      });
    });

    it('displays loan amounts', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('$500')).toBeInTheDocument();
        expect(screen.getByText('$750')).toBeInTheDocument();
        expect(screen.getByText('$600')).toBeInTheDocument();
      });
    });

    it('displays commission earned per handover', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('+$25.00')).toBeInTheDocument();
        expect(screen.getByText('+$37.50')).toBeInTheDocument();
        expect(screen.getByText('+$30.00')).toBeInTheDocument();
      });
    });

    it('displays completion dates', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        // Dates formatted as "Feb 25, 2026" etc. via toLocaleDateString('en-ZW')
        const dateElements = screen.getAllByText(/Feb/i);
        expect(dateElements.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('does not show completed section when there are no completed handovers', async () => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue([]);

      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText(/No handovers yet/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/Completed Handovers \(\d+\)/)).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue([]);
    });

    it('shows empty state when no completed handovers exist', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('No handovers yet')).toBeInTheDocument();
        expect(
          screen.getByText(
            /Start a handover when a customer with an approved loan comes to collect their device/i
          )
        ).toBeInTheDocument();
      });
    });

    it('shows a "Start Handover" button in the empty state', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        // There should be two Start Handover buttons: one in header, one in empty CTA
        const startButtons = screen.getAllByRole('button', { name: /Start Handover/i });
        expect(startButtons.length).toBe(2);
      });
    });

    it('clicking "Start Handover" in empty state opens wizard', async () => {
      const user = userEvent.setup();
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('No handovers yet')).toBeInTheDocument();
      });

      // Click the second Start Handover button (the one in the empty state CTA)
      const startButtons = screen.getAllByRole('button', { name: /Start Handover/i });
      await user.click(startButtons[1]);

      await waitFor(() => {
        expect(screen.getByTestId('handover-wizard')).toBeInTheDocument();
      });
    });
  });

  describe('Wizard View', () => {
    beforeEach(() => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockCompletedHandovers);
    });

    it('switches to wizard view when "Start Handover" is clicked', async () => {
      const user = userEvent.setup();
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Handover/i })).toBeInTheDocument();
      });

      const startButton = screen.getByRole('button', { name: /Start Handover/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByTestId('handover-wizard')).toBeInTheDocument();
      });
    });

    it('hides the list view when wizard is active', async () => {
      const user = userEvent.setup();
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('Completed Handovers (3)')).toBeInTheDocument();
      });

      const startButton = screen.getByRole('button', { name: /Start Handover/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByTestId('handover-wizard')).toBeInTheDocument();
        expect(screen.queryByText('Completed Handovers (3)')).not.toBeInTheDocument();
      });
    });

    it('returns to list view when wizard is completed', async () => {
      const user = userEvent.setup();
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Handover/i })).toBeInTheDocument();
      });

      // Click to open wizard
      const startButton = screen.getByRole('button', { name: /Start Handover/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByTestId('handover-wizard')).toBeInTheDocument();
      });

      // Complete the wizard
      const completeButton = screen.getByRole('button', { name: /Complete Handover/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('handover-wizard')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Device Handovers/i })).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('calls fetchCompletedHandovers on mount', async () => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockCompletedHandovers);

      render(<HandoversPage />);

      await waitFor(() => {
        expect(api.fetchCompletedHandovers).toHaveBeenCalledTimes(1);
      });
    });

    it('refetches data when wizard completes', async () => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockCompletedHandovers);

      const user = userEvent.setup();
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Handover/i })).toBeInTheDocument();
      });

      // Open wizard
      const startButton = screen.getByRole('button', { name: /Start Handover/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByTestId('handover-wizard')).toBeInTheDocument();
      });

      // Clear the mock to track new calls
      (api.fetchCompletedHandovers as jest.Mock).mockClear();

      // Complete the wizard
      const completeButton = screen.getByRole('button', { name: /Complete Handover/i });
      await user.click(completeButton);

      // After wizard completes, queries should be invalidated triggering a refetch
      await waitFor(() => {
        expect(api.fetchCompletedHandovers).toHaveBeenCalled();
      });
    });
  });

  describe('With Factory-Generated Data', () => {
    it('renders a list of factory-generated handovers', async () => {
      const handovers = createCompletedHandovers(5);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(handovers);

      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('Completed Handovers (5)')).toBeInTheDocument();
      });

      // Each handover should show its customer name
      for (const handover of handovers) {
        expect(screen.getByText(handover.customer_name)).toBeInTheDocument();
      }
    });

    it('correctly sums commission from factory-generated handovers', async () => {
      const handovers = createCompletedHandovers(3);
      // Default commission_earned from factory is 15.00 each
      const expectedTotal = handovers.reduce((sum, h) => sum + h.commission_earned, 0);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(handovers);

      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText(`$${expectedTotal.toFixed(2)}`)).toBeInTheDocument();
      });
    });
  });
});
