import React from 'react';
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { renderWithProviders } from '@/test/helpers';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/payments',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/lib/api/payments', () => ({
  getPayments: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  getPaymentStats: jest.fn().mockResolvedValue(null),
}));
jest.mock('@lynia/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  formatCurrencyDetailed: (n: number) => `$${n}`,
  formatDate: (d: string) => d,
}));

import PaymentsPage from '../_client';

describe('Payments Page', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<PaymentsPage />);
    expect(container).toBeTruthy();
  });

  it('renders search input', () => {
    renderWithProviders(<PaymentsPage />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = renderWithProviders(<PaymentsPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
