import React from 'react';
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { renderWithProviders } from '@/test/helpers';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/customers',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/lib/api/customers', () => ({
  getCustomers: jest.fn().mockResolvedValue({ data: [], total: 0 }),
}));
jest.mock('@/hooks/use-debounced-value', () => ({
  useDebouncedValue: (val: string) => val,
}));
jest.mock('@lynia/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  formatCurrency: (n: number) => `$${n}`,
  formatDate: (d: string) => d,
}));

import CustomersPage from '../_client';

describe('Customers Page', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<CustomersPage />);
    expect(container).toBeTruthy();
  });

  it('renders search input', () => {
    renderWithProviders(<CustomersPage />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = renderWithProviders(<CustomersPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
