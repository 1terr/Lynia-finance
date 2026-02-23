import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import HandoversPage from '@/app/(dashboard)/handovers/_client';
import * as api from '@/lib/api';
import {
  createPendingHandovers,
  createPendingHandover,
  resetFactoryCounters,
} from '@/__tests__/fixtures/factories';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  fetchPendingHandovers: jest.fn(),
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
  const mockPendingHandovers = [
    createPendingHandover({
      id: 'handover_1',
      customer_name: 'John Doe',
      device_model: 'Samsung Galaxy A15',
      loan_id: 'LOAN-001',
      loan_amount: 500,
      deposit_amount: 50,
      deposit_paid: true,
      status: 'pending',
      scheduled_date: '2026-02-25T10:00:00Z',
    }),
    createPendingHandover({
      id: 'handover_2',
      customer_name: 'Jane Smith',
      device_model: 'iPhone 12',
      loan_id: 'LOAN-002',
      loan_amount: 750,
      deposit_amount: 100,
      deposit_paid: false,
      status: 'pending',
      scheduled_date: '2026-02-26T14:00:00Z',
    }),
  ];

  const mockCompletedHandovers = [
    createPendingHandover({
      id: 'handover_3',
      customer_name: 'Bob Johnson',
      device_model: 'Samsung Galaxy S21',
      loan_id: 'LOAN-003',
      loan_amount: 600,
      status: 'completed',
      scheduled_date: '2026-02-20T10:00:00Z',
    }),
  ];

  const mockMixedHandovers = [...mockPendingHandovers, ...mockCompletedHandovers];

  beforeEach(() => {
    resetFactoryCounters();
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading skeleton while fetching handovers', () => {
      (api.fetchPendingHandovers as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<HandoversPage />);

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Page Header', () => {
    beforeEach(() => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockMixedHandovers);
    });

    it('renders page title and description', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Device Handovers/i })).toBeInTheDocument();
        expect(screen.getByText(/Manage device deliveries to customers/i)).toBeInTheDocument();
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
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockMixedHandovers);
    });

    it('displays pending handovers count', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        const pendingLabels = screen.getAllByText('Pending');
        expect(pendingLabels.length).toBeGreaterThan(0);
        // Should show count of 2 (mockPendingHandovers.length)
        const statCards = screen.getAllByText('2');
        expect(statCards.length).toBeGreaterThan(0);
      });
    });

    it('displays completed handovers count', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        const completedLabels = screen.getAllByText('Completed');
        expect(completedLabels.length).toBeGreaterThan(0);
        // Should show count of 1 (mockCompletedHandovers.length)
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('displays total handovers count', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
        // Should show count of 3 (mockMixedHandovers.length)
        const totalCounts = screen.getAllByText('3');
        expect(totalCounts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Pending Handovers Section', () => {
    beforeEach(() => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockMixedHandovers);
    });

    it('renders section header with pending count', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText(/Pending Handovers \(2\)/i)).toBeInTheDocument();
      });
    });

    it('displays pending handover customer names', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('displays device models and loan IDs', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
        expect(screen.getByText(/iPhone 12/i)).toBeInTheDocument();
        expect(screen.getByText(/LOAN-001/i)).toBeInTheDocument();
        expect(screen.getByText(/LOAN-002/i)).toBeInTheDocument();
      });
    });

    it('displays loan amounts', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        const amounts = screen.getAllByText('$500');
        expect(amounts.length).toBeGreaterThan(0);
        const amounts2 = screen.getAllByText('$750');
        expect(amounts2.length).toBeGreaterThan(0);
      });
    });

    it('shows "Deposit Paid" badge when deposit is paid', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('Deposit Paid')).toBeInTheDocument();
      });
    });

    it('shows deposit amount due badge when deposit is not paid', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('$100 due')).toBeInTheDocument();
      });
    });

    it('displays scheduled dates', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        // Dates should be formatted like "Tue, Feb 25"
        const dateElements = screen.getAllByText(/Feb/i);
        expect(dateElements.length).toBeGreaterThan(0);
      });
    });

    it('shows empty state when no pending handovers', async () => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockCompletedHandovers);

      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('No pending handovers')).toBeInTheDocument();
      });
    });

    it('clicking pending handover opens wizard', async () => {
      const user = userEvent.setup();
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const handoverButton = screen.getByText('John Doe').closest('button');
      await user.click(handoverButton!);

      await waitFor(() => {
        expect(screen.getByTestId('handover-wizard')).toBeInTheDocument();
      });
    });
  });

  describe('Completed Handovers Section', () => {
    beforeEach(() => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockMixedHandovers);
    });

    it('renders completed section when there are completed handovers', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        const completedHeaders = screen.getAllByText(/Completed/i);
        // Should have at least 2: one in stats, one in section header
        expect(completedHeaders.length).toBeGreaterThan(1);
      });
    });

    it('displays completed handover details', async () => {
      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.getByText(/Samsung Galaxy S21/i)).toBeInTheDocument();
        expect(screen.getByText(/LOAN-003/i)).toBeInTheDocument();
      });
    });

    it('does not render completed section when no completed handovers', async () => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockPendingHandovers);

      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Should not have a "Completed (X)" header in the list
      const completedTexts = screen.queryAllByText(/Completed \(\d+\)/i);
      expect(completedTexts.length).toBe(0);
    });
  });

  describe('Wizard View', () => {
    beforeEach(() => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockMixedHandovers);
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

  describe('Empty State', () => {
    it('shows empty pending section when no handovers exist', async () => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue([]);

      render(<HandoversPage />);

      await waitFor(() => {
        expect(screen.getByText('No pending handovers')).toBeInTheDocument();
      });
    });

    it('displays zero counts in stats when no handovers', async () => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue([]);

      render(<HandoversPage />);

      await waitFor(() => {
        const zeroCounts = screen.getAllByText('0');
        expect(zeroCounts.length).toBeGreaterThanOrEqual(3); // All three stat cards
      });
    });
  });

  describe('Data Fetching', () => {
    it('calls fetchPendingHandovers on mount', async () => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockMixedHandovers);

      render(<HandoversPage />);

      await waitFor(() => {
        expect(api.fetchPendingHandovers).toHaveBeenCalledTimes(1);
      });
    });
  });
});
