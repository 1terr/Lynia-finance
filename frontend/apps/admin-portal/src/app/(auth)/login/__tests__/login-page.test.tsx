import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        signIn: jest.fn().mockResolvedValue({}),
        challenge: null,
        completeNewPassword: jest.fn(),
        completeMfaChallenge: jest.fn(),
        forgotPassword: jest.fn(),
        confirmForgotPassword: jest.fn(),
      }),
    { getState: () => ({ challenge: null }) }
  ),
}));

import LoginPage from '../page';

describe('Login Page', () => {
  it('renders sign in heading', () => {
    render(<LoginPage />);
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it('renders email input', () => {
    render(<LoginPage />);
    const emailInput = screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i);
    expect(emailInput).toBeInTheDocument();
  });

  it('renders password input', () => {
    render(<LoginPage />);
    const passwordInput = screen.getByLabelText(/password/i) || screen.getByPlaceholderText(/password/i);
    expect(passwordInput).toBeInTheDocument();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<LoginPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
