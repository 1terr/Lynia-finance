import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/api/devices', () => ({
  getDeviceHandovers: jest.fn().mockResolvedValue({
    data: [],
    total: 0,
    page: 1,
    limit: 25,
    total_pages: 0,
  }),
}));

jest.mock('@/lib/auth/context', () => ({
  useAuth: () => ({
    user: { id: 'admin-001', role: 'super_admin' },
    isLoading: false,
  }),
}));

jest.mock('@/lib/auth/permissions', () => ({
  hasPermission: () => true,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/devices/handovers',
}));

import HandoversPage from '../_client';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('HandoversPage', () => {
  it('renders page header', () => {
    renderWithProviders(<HandoversPage />);
    expect(screen.getByText('Device Handovers')).toBeInTheDocument();
    expect(screen.getByText('Schedule and track device handovers to customers')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    renderWithProviders(<HandoversPage />);
    expect(screen.getByText('Devices')).toBeInTheDocument();
    expect(screen.getByText('Handovers')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderWithProviders(<HandoversPage />);
    expect(screen.getByPlaceholderText('Search by customer name or IMEI...')).toBeInTheDocument();
  });

  it('renders status filter dropdown', () => {
    renderWithProviders(<HandoversPage />);
    expect(screen.getByText('All Statuses')).toBeInTheDocument();
  });

  it('shows empty state when no handovers', async () => {
    renderWithProviders(<HandoversPage />);
    expect(await screen.findByText('No handovers found')).toBeInTheDocument();
  });
});
