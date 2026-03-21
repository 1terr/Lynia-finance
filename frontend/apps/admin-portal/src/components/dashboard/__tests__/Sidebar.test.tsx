import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}));
jest.mock('@/lib/auth/context', () => ({
  useAuth: jest.fn(() => ({
    user: {
      id: 'admin-1',
      full_name: 'Test Admin',
      email: 'admin@lynia.co.zw',
      role: 'super_admin',
    },
    isLoading: false,
  })),
}));
jest.mock('@/lib/auth/permissions', () => ({
  hasPermission: jest.fn(() => true),
}));
jest.mock('@lynia/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import { Sidebar } from '@/components/dashboard/Sidebar';
import { hasPermission } from '@/lib/auth/permissions';

describe('Sidebar', () => {
  const defaultProps = {
    isOpen: false,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (hasPermission as jest.Mock).mockReturnValue(true);
  });

  it('renders "Lynia Admin" logo text', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Lynia Admin')).toBeInTheDocument();
  });

  it('renders all navigation items for super_admin', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Loans')).toBeInTheDocument();
    expect(screen.getByText('Devices')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('renders child navigation items', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('All Customers')).toBeInTheDocument();
    expect(screen.getByText('KYC Review')).toBeInTheDocument();
    expect(screen.getByText('All Loans')).toBeInTheDocument();
    expect(screen.getByText('Sync Issues')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Handovers')).toBeInTheDocument();
    expect(screen.getByText('Lock/Unlock')).toBeInTheDocument();
    expect(screen.getByText('All Payments')).toBeInTheDocument();
    expect(screen.getByText('Collections')).toBeInTheDocument();
  });

  it('hides items when hasPermission returns false', () => {
    (hasPermission as jest.Mock).mockImplementation(
      (_role: string, resource: string, _action: string) => resource !== 'reports'
    );
    render(<Sidebar {...defaultProps} />);
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
  });

  it('shows user name in footer', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Test Admin')).toBeInTheDocument();
  });

  it('shows user email in footer', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('admin@lynia.co.zw')).toBeInTheDocument();
  });

  it('calls onClose when mobile overlay is clicked', () => {
    const onClose = jest.fn();
    const { container } = render(<Sidebar isOpen={true} onClose={onClose} />);
    const overlay = container.querySelector('[data-testid="sidebar-overlay"]') ||
      container.querySelector('.fixed.inset-0');
    if (overlay) {
      fireEvent.click(overlay);
    }
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
