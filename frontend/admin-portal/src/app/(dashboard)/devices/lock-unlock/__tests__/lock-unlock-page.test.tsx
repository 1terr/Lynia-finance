import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/api/devices', () => ({
  getDevices: jest.fn().mockResolvedValue({
    data: [],
    total: 0,
    page: 1,
    limit: 25,
    total_pages: 0,
  }),
  getDeviceStats: jest.fn().mockResolvedValue({
    in_stock: 10,
    allocated: 5,
    active: 20,
    locked: 3,
    returned: 2,
    damaged: 1,
  }),
  lockDevice: jest.fn(),
  unlockDevice: jest.fn(),
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
  usePathname: () => '/devices/lock-unlock',
}));

import LockUnlockPage from '../_client';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('LockUnlockPage', () => {
  it('renders page header', () => {
    renderWithProviders(<LockUnlockPage />);
    expect(screen.getByText('Device Lock/Unlock')).toBeInTheDocument();
    expect(screen.getByText('Remotely control device lock status')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    renderWithProviders(<LockUnlockPage />);
    expect(screen.getByText('Devices')).toBeInTheDocument();
    expect(screen.getByText('Lock/Unlock')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderWithProviders(<LockUnlockPage />);
    expect(screen.getByPlaceholderText('Search by IMEI, brand, or model...')).toBeInTheDocument();
  });

  it('renders lock status filter', () => {
    renderWithProviders(<LockUnlockPage />);
    expect(screen.getByText('All Lock States')).toBeInTheDocument();
  });

  it('renders device stats cards', async () => {
    renderWithProviders(<LockUnlockPage />);
    expect(await screen.findByText('Locked Devices')).toBeInTheDocument();
    expect(screen.getByText('Active Devices')).toBeInTheDocument();
    expect(screen.getByText('Total Allocated')).toBeInTheDocument();
  });

  it('displays stats values', async () => {
    renderWithProviders(<LockUnlockPage />);
    // 3 locked devices from mock
    expect(await screen.findByText('3')).toBeInTheDocument();
    // 20 active devices
    expect(screen.getByText('20')).toBeInTheDocument();
    // 25 total allocated (5 allocated + 20 active)
    expect(screen.getByText('25')).toBeInTheDocument();
  });
});
