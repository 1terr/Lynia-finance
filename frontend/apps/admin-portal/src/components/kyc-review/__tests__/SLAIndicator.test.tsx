import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { SLAIndicator } from '@/components/kyc-review/SLAIndicator';
import { getSLAStatus } from '@lynia/utils';

jest.mock('@lynia/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  getSLAStatus: jest.fn(),
}));

const mockGetSLAStatus = getSLAStatus as jest.Mock;

describe('SLAIndicator', () => {
  const futureDeadline = new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString();

  beforeEach(() => {
    mockGetSLAStatus.mockReturnValue({
      label: '18h remaining',
      color: 'green',
      isExpired: false,
      hoursRemaining: 18,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders SLA label in full mode with "SLA:" prefix', () => {
    render(<SLAIndicator deadline={futureDeadline} />);

    expect(screen.getByText(/SLA:/)).toBeInTheDocument();
    expect(screen.getByText(/18h remaining/)).toBeInTheDocument();
  });

  it('renders compact mode without "SLA:" prefix', () => {
    render(<SLAIndicator deadline={futureDeadline} compact />);

    expect(screen.queryByText(/SLA:/)).not.toBeInTheDocument();
    expect(screen.getByText(/18h remaining/)).toBeInTheDocument();
  });

  it('shows progress bar in full mode', () => {
    const { container } = render(<SLAIndicator deadline={futureDeadline} />);

    const progressBar = container.querySelector('[role="progressbar"]') ||
      container.querySelector('[class*="progress"]') ||
      container.querySelector('[class*="bar"]');

    expect(progressBar).toBeInTheDocument();
  });

  it('shows CRITICAL badge when expired > 48 hours', () => {
    const pastDeadline = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();

    mockGetSLAStatus.mockReturnValue({
      label: 'Overdue 50h',
      color: 'red',
      isExpired: true,
      hoursRemaining: -50,
    });

    render(<SLAIndicator deadline={pastDeadline} />);

    expect(screen.getByText(/CRITICAL/i)).toBeInTheDocument();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<SLAIndicator deadline={futureDeadline} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
