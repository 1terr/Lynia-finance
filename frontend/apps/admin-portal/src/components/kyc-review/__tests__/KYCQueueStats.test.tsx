import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { KYCQueueStats } from '@/components/kyc-review/KYCQueueStats';

describe('KYCQueueStats', () => {
  const defaultProps = {
    total: 150,
    pending: 42,
    approved: 95,
    rejected: 13,
  };

  it('renders all four stat cards with labels', () => {
    render(<KYCQueueStats {...defaultProps} />);

    expect(screen.getByText('Total Submissions')).toBeInTheDocument();
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('displays correct values for each stat', () => {
    render(<KYCQueueStats {...defaultProps} />);

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <KYCQueueStats {...defaultProps} className="custom-stats" />
    );

    expect(container.firstChild).toHaveClass('custom-stats');
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<KYCQueueStats {...defaultProps} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
