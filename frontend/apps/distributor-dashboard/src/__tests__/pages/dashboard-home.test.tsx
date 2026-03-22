import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import DashboardHome from '@/app/(dashboard)/_client';
import * as api from '@/lib/api';
import {
  createDashboardStats,
  createCompletedHandover,
  createCompletedHandovers,
  resetFactoryCounters,
} from '@/__tests__/fixtures/factories';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  fetchDashboardStats: jest.fn(),
  fetchCompletedHandovers: jest.fn(),
  fetchInventory: jest.fn().mockResolvedValue([]),
  fetchCommissions: jest.fn().mockResolvedValue({ data: [], total: 0 }),
}));

describe('DashboardHome', () => {
  const mockStats = createDashboardStats({
    total_devices_distributed: 42,
    current_inventory: 15,
    total_commissions_earned: 1250.0,
    total_commissions_paid: 800.0,
    pending_commissions: 450.0,
    average_rating: 4.7,
    monthly_handovers: 12,
    last_month_handovers: 9,
  });

  const mockHandovers = createCompletedHandovers(3);

  beforeEach(() => {
    resetFactoryCounters();
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading skeleton while fetching stats', () => {
      (api.fetchDashboardStats as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue([]);

      const { container } = render(<DashboardHome />);

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('shows loading skeleton while fetching handovers', () => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchCompletedHandovers as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<DashboardHome />);

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when stats fetch fails', async () => {
      (api.fetchDashboardStats as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue([]);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load dashboard/i)).toBeInTheDocument();
      });
    });

    it('shows error message when handovers fetch fails', async () => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchCompletedHandovers as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load dashboard/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      (api.fetchDashboardStats as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue([]);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Header', () => {
    beforeEach(() => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);
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

  describe('Start New Handover CTA', () => {
    beforeEach(() => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);
    });

    it('renders Start New Handover link', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Start New Handover/i)).toBeInTheDocument();
      });
    });

    it('links to /handovers', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        const link = screen.getByText(/Start New Handover/i).closest('a');
        expect(link).toHaveAttribute('href', '/handovers');
      });
    });
  });

  describe('Stats Display', () => {
    beforeEach(() => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);
    });

    it('displays total devices distributed', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText(/Devices Distributed/i)).toBeInTheDocument();
      });
    });

    it('displays monthly handovers count with "this month" label', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('12 this month')).toBeInTheDocument();
      });
    });

    it('displays positive monthly diff when current month exceeds last month', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        // 12 - 9 = +3
        expect(screen.getByText('+3 vs last')).toBeInTheDocument();
      });
    });

    it('displays negative monthly diff when current month is lower', async () => {
      const statsDown = createDashboardStats({
        monthly_handovers: 5,
        last_month_handovers: 8,
      });
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(statsDown);

      render(<DashboardHome />);

      await waitFor(() => {
        // 5 - 8 = -3
        expect(screen.getByText('-3 vs last')).toBeInTheDocument();
      });
    });

    it('does not display monthly diff when months are equal', async () => {
      const statsEqual = createDashboardStats({
        monthly_handovers: 10,
        last_month_handovers: 10,
      });
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(statsEqual);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('10 this month')).toBeInTheDocument();
      });

      expect(screen.queryByText(/vs last/i)).not.toBeInTheDocument();
    });

    it('displays current inventory count', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getByText(/In Inventory/i)).toBeInTheDocument();
        expect(screen.getByText(/devices available/i)).toBeInTheDocument();
      });
    });

    it('displays total earned in green with dollar formatting', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        const earnedElements = screen.getAllByText('$1250.00');
        expect(earnedElements.length).toBeGreaterThanOrEqual(1);
        const earnedLabels = screen.getAllByText(/Total Earned/i);
        expect(earnedLabels.length).toBeGreaterThanOrEqual(1);
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

  describe('Quick Actions', () => {
    beforeEach(() => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);
    });

    it('renders Start Handover quick action linking to /handovers', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        const link = screen.getByText('Start Handover').closest('a');
        expect(link).toHaveAttribute('href', '/handovers');
      });
    });

    it('renders Check Inventory quick action linking to /inventory', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        const link = screen.getByText('Check Inventory').closest('a');
        expect(link).toHaveAttribute('href', '/inventory');
      });
    });

    it('renders View Earnings quick action linking to /commissions', async () => {
      render(<DashboardHome />);

      await waitFor(() => {
        const link = screen.getByText('View Earnings').closest('a');
        expect(link).toHaveAttribute('href', '/commissions');
      });
    });
  });

  describe('Commission Summary', () => {
    beforeEach(() => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);
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
        // Total Earned appears in both stats card and commission summary
        const earnedValues = screen.getAllByText('$1250.00');
        expect(earnedValues.length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/Total Earned/i).length).toBeGreaterThanOrEqual(1);
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
        const links = screen.getAllByRole('link', { name: /View all/i });
        const commissionsLink = links.find(
          (link) => link.getAttribute('href') === '/commissions'
        );
        expect(commissionsLink).toBeDefined();
      });
    });
  });

  describe('Recent Handovers List', () => {
    beforeEach(() => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    });

    it('renders recent handovers heading', async () => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Recent Handovers/i)).toBeInTheDocument();
      });
    });

    it('displays handover customer names', async () => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        mockHandovers.forEach((handover) => {
          expect(screen.getByText(handover.customer_name)).toBeInTheDocument();
        });
      });
    });

    it('displays handover device models and loan IDs', async () => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);

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
      const handoversWithAmounts = [
        createCompletedHandover({ loan_amount: 500 }),
        createCompletedHandover({ loan_amount: 750 }),
      ];
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(handoversWithAmounts);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('$500')).toBeInTheDocument();
        expect(screen.getByText('$750')).toBeInTheDocument();
      });
    });

    it('displays commission earned for each handover', async () => {
      const handoversWithCommission = [
        createCompletedHandover({ commission_earned: 25.0 }),
        createCompletedHandover({ commission_earned: 37.5 }),
      ];
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(handoversWithCommission);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText('+$25.00')).toBeInTheDocument();
        expect(screen.getByText('+$37.50')).toBeInTheDocument();
      });
    });

    it('shows only the last 5 completed handovers', async () => {
      const manyHandovers = createCompletedHandovers(8);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(manyHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        // First 5 should be displayed
        for (let i = 0; i < 5; i++) {
          expect(screen.getByText(manyHandovers[i].customer_name)).toBeInTheDocument();
        }
        // 6th, 7th, 8th should not be displayed
        for (let i = 5; i < 8; i++) {
          expect(screen.queryByText(manyHandovers[i].customer_name)).not.toBeInTheDocument();
        }
      });
    });

    it('shows empty state when no completed handovers', async () => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue([]);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/No completed handovers yet/i)).toBeInTheDocument();
      });
    });

    it('shows link to handovers page', async () => {
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        const links = screen.getAllByRole('link', { name: /View all/i });
        const handoversLink = links.find(
          (link) => link.getAttribute('href') === '/handovers'
        );
        expect(handoversLink).toBeDefined();
      });
    });
  });

  describe('New Distributor Welcome Banner', () => {
    it('shows welcome banner when distributor has no activity', async () => {
      const emptyStats = createDashboardStats({
        total_devices_distributed: 0,
        current_inventory: 0,
        total_commissions_earned: 0,
        total_commissions_paid: 0,
        pending_commissions: 0,
        monthly_handovers: 0,
        last_month_handovers: 0,
      });
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(emptyStats);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue([]);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Lynia/i)).toBeInTheDocument();
      });
    });

    it('does not show welcome banner for active distributor', async () => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/Welcome to Lynia/i)).not.toBeInTheDocument();
    });
  });

  describe('Data Fetching', () => {
    it('calls fetchDashboardStats on mount', async () => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(api.fetchDashboardStats).toHaveBeenCalledTimes(1);
      });
    });

    it('calls fetchCompletedHandovers on mount', async () => {
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
      (api.fetchCompletedHandovers as jest.Mock).mockResolvedValue(mockHandovers);

      render(<DashboardHome />);

      await waitFor(() => {
        expect(api.fetchCompletedHandovers).toHaveBeenCalledTimes(1);
      });
    });
  });
});
