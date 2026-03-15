import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

jest.mock('@lynia/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import { DashboardHeader } from '@/components/dashboard/DashboardHeader';

describe('DashboardHeader', () => {
  it('renders "Lynia Finance" heading', () => {
    render(<DashboardHeader />);
    expect(screen.getByText('Lynia Finance')).toBeInTheDocument();
  });

  it('renders "Admin Dashboard" subtitle', () => {
    render(<DashboardHeader />);
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });

  it('renders notification bell button', () => {
    render(<DashboardHeader />);
    const bellButton = screen.getByRole('button', { name: /notification/i });
    expect(bellButton).toBeInTheDocument();
  });

  it('renders admin avatar with "AD" initials', () => {
    render(<DashboardHeader />);
    expect(screen.getByText('AD')).toBeInTheDocument();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<DashboardHeader />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
