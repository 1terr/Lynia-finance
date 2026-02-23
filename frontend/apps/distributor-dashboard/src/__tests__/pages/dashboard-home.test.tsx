import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import DashboardHome from '@/app/(dashboard)/_client';
import * as api from '@/lib/api';
import {
  createDashboardStats,
  createPendingHandovers,
  resetFactoryCounters,
} from '@/__tests__/fixtures/factories';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  fetchDashboardStats: jest.fn(),
  fetchPendingHandovers: jest.fn(),
}));

describe('DashboardHome', () => {
  const mockStats = createDashboardStats({
    total_devices_distributed: 42,
    current_inventory: 15,
    pending_handovers: 8,
    average_rating: 4.7,
    monthly_handovers: 12,
    total_commissions_earned: 1250.0,
    total_commissions_paid: 800.0,
    pending_commissions: 450.0,
  });

  const mockHandovers = createPendingHandovers(3);

  beforeEach(() => {
    resetFactoryCounters();
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading spinner while fetching stats', () => {
      (api.fetchDashboardStats as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue([]);

      const { container } = render(<DashboardHome />);

      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows loading spinner while fetching handovers', () => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchPendingHandovers as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<DashboardHome />);

      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Dashboard Header', () => {
    beforeEach(() => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockHandovers);
    });

    it('renders dashboard title', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument();
      });
    });

    it('renders dashboard description', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Overview of your distribution activity/i)).toBeInTheDocument();
      });
    });
  });

  describe('Stats Display', () => {
    beforeEach(() => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockHandovers);
    });

    it('displays total devices distributed', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText(/Devices Distributed/i)).toBeInTheDocument();
        expect(screen.getByText('12 this month')).toBeInTheDocument();
      });
    });

    it('displays current inventory count', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getByText(/In Inventory/i)).toBeInTheDocument();
        expect(screen.getByText(/devices available/i)).toBeInTheDocument();
      });
    });

    it('displays pending handovers count', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText(/Pending Handovers/i)).toBeInTheDocument();
        expect(screen.getByText(/need action/i)).toBeInTheDocument();
      });
    });

    it('displays average rating with one decimal', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('4.7')).toBeInTheDocument();
        expect(screen.getByText(/Rating/i)).toBeInTheDocument();
        expect(screen.getByText(/out of 5.0/i)).toBeInTheDocument();
      });
    });
  });

  describe('Commission Summary', () => {
    beforeEach(() => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockHandovers);
    });

    it('renders commission summary heading', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Commission Summary/i)).toBeInTheDocument();
      });
    });

    it('displays total earned commission', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('$1250.00')).toBeInTheDocument();
        expect(screen.getByText(/Total Earned/i)).toBeInTheDocument();
      });
    });

    it('displays paid out commission', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('$800.00')).toBeInTheDocument();
        expect(screen.getByText(/Paid Out/i)).toBeInTheDocument();
      });
    });

    it('displays pending commission', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('$450.00')).toBeInTheDocument();
        const pendingLabels = screen.getAllByText(/Pending/i);
        // Should find at least one "Pending" label in commission section
        expect(pendingLabels.length).toBeGreaterThan(0);
      });
    });

    it('shows link to commissions page', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        const link = screen.getAllByRole('link', { name: /View all/i })[0];
        expect(link).toHaveAttribute('href', '/commissions');
      });
    });
  });

  describe('Pending Handovers List', () => {
    beforeEach(() => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    });

    it('renders upcoming handovers heading', async () => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Upcoming Handovers/i)).toBeInTheDocument();
      });
    });

    it('displays handover customer names', async () => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        mockHandovers.forEach((handover) => {
          expect(screen.getByText(handover.customer_name)).toBeInTheDocument();
        });
      });
    });

    it('displays handover device models and loan IDs', async () => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        mockHandovers.forEach((handover) => {
          const deviceMatches = screen.getAllByText(new RegExp(handover.device_model));
          expect(deviceMatches.length).toBeGreaterThan(0);
          const loanMatches = screen.getAllByText(new RegExp(handover.loan_id));
          expect(loanMatches.length).toBeGreaterThan(0);
        });
      });
    });

    it('displays handover loan amounts', async () => {
      const handoversWithAmounts = createPendingHandovers(2).map((h, i) => ({
        ...h,
        loan_amount: i === 0 ? 500 : 750,
      }));
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(handoversWithAmounts);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('$500')).toBeInTheDocument();
        expect(screen.getByText('$750')).toBeInTheDocument();
      });
    });

    it('shows deposit paid badge when deposit is paid', async () => {
      const handoversPaid = createPendingHandovers(1).map((h) => ({
        ...h,
        deposit_paid: true,
      }));
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(handoversPaid);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Deposit Paid/i)).toBeInTheDocument();
      });
    });

    it('shows deposit pending badge when deposit is not paid', async () => {
      const handoversPending = createPendingHandovers(1).map((h) => ({
        ...h,
        deposit_paid: false,
      }));
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(handoversPending);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Deposit Pending/i)).toBeInTheDocument();
      });
    });

    it('shows empty state when no handovers', async () => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue([]);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/No pending handovers/i)).toBeInTheDocument();
      });
    });

    it('shows link to handovers page', async () => {
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        const links = screen.getAllByRole('link', { name: /View all/i });
        const handoversLink = links.find((link) => link.getAttribute('href') === '/handovers');
        expect(handoversLink).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('calls fetchDashboardStats on mount', async () => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(api.fetchDashboardStats).toHaveBeenCalledTimes(1);
      });
    });

    it('calls fetchPendingHandovers on mount', async () => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(api.fetchPendingHandovers).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Date Formatting', () => {
    it('formats handover scheduled dates correctly', async () => {
      const handoverWithDate = createPendingHandovers(1).map((h) => ({
        ...h,
        scheduled_date: '2026-03-15T10:00:00Z',
      }));
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchPendingHandovers as jest.Mock).mockResolvedValue(handoverWithDate);

      render(<DashboardHome />);

      await waitFor(() => {
        // Date should be formatted as "Mar 15" (may appear multiple times)
        const dates = screen.getAllByText(/15 Mar/i);
        expect(dates.length).toBeGreaterThan(0);
      });
    });
  });
});
