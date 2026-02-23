import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import CommissionsPage from '@/app/(dashboard)/commissions/_client';
import * as api from '@/lib/api';
import {
  createDashboardStats,
  createCommissions,
  createCommission,
  createPaidCommission,
  resetFactoryCounters,
} from '@/__tests__/fixtures/factories';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  fetchCommissions: jest.fn(),
  fetchDashboardStats: jest.fn(),
}));

// Mock CSV download
const mockCreateElement = document.createElement;
const mockClick = jest.fn();

describe('CommissionsPage', () => {
  const mockStats = createDashboardStats({
    total_commissions_earned: 350.0,
    total_commissions_paid: 200.0,
    pending_commissions: 150.0,
    monthly_handovers: 8,
  });

  const mockCommissions = [
    createCommission({
      id: 'comm_1',
      customer_name: 'John Doe',
      device_model: 'Samsung Galaxy A15',
      loan_id: 'loan_1',
      commission_amount: 15.0,
      commission_percentage: 5,
      device_retail_price: 300,
      payment_status: 'pending',
      calculation_date: '2026-02-15T10:00:00Z',
      paid_at: null,
    }),
    createPaidCommission({
      id: 'comm_2',
      customer_name: 'Jane Smith',
      device_model: 'iPhone 12',
      loan_id: 'loan_2',
      commission_amount: 25.0,
      commission_percentage: 5,
      device_retail_price: 500,
      payment_status: 'paid',
      calculation_date: '2026-02-10T10:00:00Z',
      paid_at: '2026-02-15T10:00:00Z',
    }),
    createCommission({
      id: 'comm_3',
      customer_name: 'Bob Wilson',
      device_model: 'Samsung Galaxy S21',
      loan_id: 'loan_3',
      commission_amount: 30.0,
      commission_percentage: 5,
      device_retail_price: 600,
      payment_status: 'pending',
      calculation_date: '2026-01-20T10:00:00Z',
      paid_at: null,
    }),
  ];

  beforeEach(() => {
    resetFactoryCounters();
    jest.clearAllMocks();

    // Mock document.createElement for CSV export
    document.createElement = jest.fn((tag) => {
      if (tag === 'a') {
        const element = mockCreateElement.call(document, tag);
        element.click = mockClick;
        return element;
      }
      return mockCreateElement.call(document, tag);
    }) as any;
  });

  afterEach(() => {
    document.createElement = mockCreateElement;
  });

  describe('Loading State', () => {
    it('shows loading skeleton while fetching data', () => {
      (api.fetchCommissions as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      (api.fetchDashboardStats as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      const { container } = render(<CommissionsPage />);

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Page Header', () => {
    beforeEach(() => {
      (api.fetchCommissions as jest.Mock).mockResolvedValue(mockCommissions);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    });

    it('renders page title', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Commissions & Earnings/i })).toBeInTheDocument();
      });
    });

    it('renders page description', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Track your earnings and performance/i)).toBeInTheDocument();
      });
    });

    it('shows export CSV button on desktop', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button', { name: /Export CSV/i });
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Summary Cards', () => {
    beforeEach(() => {
      (api.fetchCommissions as jest.Mock).mockResolvedValue(mockCommissions);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    });

    it('displays total earned', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('$350.00')).toBeInTheDocument();
        expect(screen.getByText(/Total Earned/i)).toBeInTheDocument();
        expect(screen.getByText(/3 handovers/i)).toBeInTheDocument();
      });
    });

    it('displays paid out amount', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('$200.00')).toBeInTheDocument();
        expect(screen.getByText(/Paid Out/i)).toBeInTheDocument();
        expect(screen.getByText(/1 payments/i)).toBeInTheDocument();
      });
    });

    it('displays pending amount', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        const amounts = screen.getAllByText('$150.00');
        expect(amounts.length).toBeGreaterThan(0);
        const pendingLabels = screen.getAllByText(/Pending/i);
        expect(pendingLabels.length).toBeGreaterThan(0);
        expect(screen.getByText(/2 awaiting/i)).toBeInTheDocument();
      });
    });

    it('displays this month earnings', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        const thisMonthLabels = screen.getAllByText(/This Month/i);
        expect(thisMonthLabels.length).toBeGreaterThan(0);
        expect(screen.getByText(/8 handovers/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Tier', () => {
    it('shows Bronze tier for low earnings', async () => {
      const lowStats = createDashboardStats({ total_commissions_earned: 100 });
      (api.fetchCommissions as jest.Mock).mockResolvedValue([]);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(lowStats);

      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('Bronze')).toBeInTheDocument();
        expect(screen.getByText(/to Silver/i)).toBeInTheDocument();
      });
    });

    it('shows Silver tier for medium earnings', async () => {
      const mediumStats = createDashboardStats({ total_commissions_earned: 300 });
      (api.fetchCommissions as jest.Mock).mockResolvedValue([]);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mediumStats);

      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('Silver')).toBeInTheDocument();
        expect(screen.getByText(/to Gold/i)).toBeInTheDocument();
      });
    });

    it('shows Gold tier for high earnings', async () => {
      const highStats = createDashboardStats({ total_commissions_earned: 500 });
      (api.fetchCommissions as jest.Mock).mockResolvedValue([]);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(highStats);

      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('Gold')).toBeInTheDocument();
        expect(screen.getByText(/Max tier/i)).toBeInTheDocument();
      });
    });

    it('displays performance metrics', async () => {
      (api.fetchCommissions as jest.Mock).mockResolvedValue(mockCommissions);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);

      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Total Handovers/i)).toBeInTheDocument();
        expect(screen.getByText(/Commission Rate/i)).toBeInTheDocument();
        expect(screen.getByText(/Avg per Handover/i)).toBeInTheDocument();
        expect(screen.getByText('5%')).toBeInTheDocument();
      });
    });
  });

  describe('Payment Status Filters', () => {
    beforeEach(() => {
      (api.fetchCommissions as jest.Mock).mockResolvedValue(mockCommissions);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    });

    it('renders all payment filter options', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        const filterGroup = screen.getByRole('group', { name: /Filter by payment status/i });
        expect(filterGroup).toBeInTheDocument();

        const buttons = screen.getAllByRole('button');
        const allButton = buttons.find(b => b.textContent === 'All');
        const paidButton = buttons.find(b => b.textContent === 'Paid');
        const pendingButton = buttons.find(b => b.textContent === 'Pending');

        expect(allButton).toBeInTheDocument();
        expect(paidButton).toBeInTheDocument();
        expect(pendingButton).toBeInTheDocument();
      });
    });

    it('filters commissions by paid status', async () => {
      const user = userEvent.setup();
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const paidButton = buttons.find(b => b.textContent === 'Paid')!;
      await user.click(paidButton);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });

    it('filters commissions by pending status', async () => {
      const user = userEvent.setup();
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const pendingButton = buttons.find(b => b.textContent === 'Pending')!;
      await user.click(pendingButton);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('shows all commissions when All filter is selected', async () => {
      const user = userEvent.setup();
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // First filter to paid
      const buttons = screen.getAllByRole('button');
      const paidButton = buttons.find(b => b.textContent === 'Paid')!;
      await user.click(paidButton);

      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });

      // Then click All to show all again
      const allButton = screen.getAllByRole('button').find(b => b.textContent === 'All')!;
      await user.click(allButton);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
      });
    });
  });

  describe('Period Filters', () => {
    beforeEach(() => {
      (api.fetchCommissions as jest.Mock).mockResolvedValue(mockCommissions);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    });

    it('renders all period filter options', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        const filterGroup = screen.getByRole('group', { name: /Filter by time period/i });
        expect(filterGroup).toBeInTheDocument();

        expect(screen.getByText('All Time')).toBeInTheDocument();
        const thisMonthLabels = screen.getAllByText('This Month');
        expect(thisMonthLabels.length).toBeGreaterThan(0);
        expect(screen.getByText('Last Month')).toBeInTheDocument();
      });
    });

    it('filters commissions by this month', async () => {
      const user = userEvent.setup();
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const thisMonthButton = buttons.find(b => b.textContent === 'This Month')!;
      await user.click(thisMonthButton);

      await waitFor(() => {
        // Feb 2026 entries (John and Jane)
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        // Jan 2026 entry (Bob) should be filtered out
        expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument();
      });
    });

    it('combines payment and period filters', async () => {
      const user = userEvent.setup();
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Filter by paid
      let buttons = screen.getAllByRole('button');
      const paidButton = buttons.find(b => b.textContent === 'Paid')!;
      await user.click(paidButton);

      // Then filter by this month
      buttons = screen.getAllByRole('button');
      const thisMonthButton = buttons.find(b => b.textContent === 'This Month')!;
      await user.click(thisMonthButton);

      await waitFor(() => {
        // Only Jane should show (paid + this month)
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument();
      });
    });
  });

  describe('Commission History List', () => {
    beforeEach(() => {
      (api.fetchCommissions as jest.Mock).mockResolvedValue(mockCommissions);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    });

    it('displays commission history heading', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Commission History/i)).toBeInTheDocument();
        expect(screen.getByText(/3 entries/i)).toBeInTheDocument();
      });
    });

    it('displays customer names', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
      });
    });

    it('displays device models and loan IDs', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Samsung Galaxy A15/i)).toBeInTheDocument();
        expect(screen.getByText(/iPhone 12/i)).toBeInTheDocument();
        expect(screen.getByText(/loan_1/i)).toBeInTheDocument();
        expect(screen.getByText(/loan_2/i)).toBeInTheDocument();
      });
    });

    it('displays commission amounts', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('+$15.00')).toBeInTheDocument();
        expect(screen.getByText('+$25.00')).toBeInTheDocument();
        expect(screen.getByText('+$30.00')).toBeInTheDocument();
      });
    });

    it('displays commission percentages and retail prices', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText(/5% of \$300/i)).toBeInTheDocument();
        expect(screen.getByText(/5% of \$500/i)).toBeInTheDocument();
        expect(screen.getByText(/5% of \$600/i)).toBeInTheDocument();
      });
    });

    it('shows paid status badges', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        const badges = screen.getAllByText('Paid');
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('shows pending status badges', async () => {
      render(<CommissionsPage />);

      await waitFor(() => {
        const badges = screen.getAllByText(/Pending/i);
        // Should have badges in the list + possibly in the summary card
        expect(badges.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no commissions exist', async () => {
      (api.fetchCommissions as jest.Mock).mockResolvedValue([]);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);

      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText(/No commission entries match your filters/i)).toBeInTheDocument();
      });
    });

    it('shows empty state when filters return no results', async () => {
      const user = userEvent.setup();
      const pendingOnly = mockCommissions.filter(c => c.payment_status === 'pending');
      (api.fetchCommissions as jest.Mock).mockResolvedValue(pendingOnly);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);

      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Filter by paid (but we only have pending)
      const buttons = screen.getAllByRole('button');
      const paidButton = buttons.find(b => b.textContent === 'Paid')!;
      await user.click(paidButton);

      await waitFor(() => {
        expect(screen.getByText(/No commission entries match your filters/i)).toBeInTheDocument();
      });
    });
  });

  describe('CSV Export', () => {
    beforeEach(() => {
      (api.fetchCommissions as jest.Mock).mockResolvedValue(mockCommissions);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);

      // Mock URL methods
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();
    });

    it('triggers CSV download when export button is clicked', async () => {
      const user = userEvent.setup();
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { name: /Export CSV/i });
      await user.click(buttons[0]);

      expect(mockClick).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('exports filtered commissions only', async () => {
      const user = userEvent.setup();
      render(<CommissionsPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Filter to paid only
      const buttons = screen.getAllByRole('button');
      const paidButton = buttons.find(b => b.textContent === 'Paid')!;
      await user.click(paidButton);

      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });

      // Export filtered data
      const exportButtons = screen.getAllByRole('button', { name: /Export CSV/i });
      await user.click(exportButtons[0]);

      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Data Fetching', () => {
    it('calls fetchCommissions on mount', async () => {
      (api.fetchCommissions as jest.Mock).mockResolvedValue(mockCommissions);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);

      render(<CommissionsPage />);

      await waitFor(() => {
        expect(api.fetchCommissions).toHaveBeenCalledTimes(1);
      });
    });

    it('calls fetchDashboardStats on mount', async () => {
      (api.fetchCommissions as jest.Mock).mockResolvedValue(mockCommissions);
      (api.fetchDashboardStats as jest.Mock).mockResolvedValue(mockStats);

      render(<CommissionsPage />);

      await waitFor(() => {
        expect(api.fetchDashboardStats).toHaveBeenCalledTimes(1);
      });
    });
  });
});
