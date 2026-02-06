import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerHeader } from '../CustomerHeader';
import { mockCustomerWithRelations } from '@/test/mocks/customers';

describe('CustomerHeader', () => {
  it('renders customer name', () => {
    render(<CustomerHeader customer={mockCustomerWithRelations} />);

    expect(screen.getByText('John Moyo')).toBeInTheDocument();
  });

  it('renders customer ID', () => {
    render(<CustomerHeader customer={mockCustomerWithRelations} />);

    expect(
      screen.getByText(`Customer ID: ${mockCustomerWithRelations.id}`)
    ).toBeInTheDocument();
  });

  it('shows KYC verified badge', () => {
    render(<CustomerHeader customer={mockCustomerWithRelations} />);

    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('shows credit tier badge', () => {
    render(<CustomerHeader customer={mockCustomerWithRelations} />);

    expect(screen.getByText('Tier 2')).toBeInTheDocument();
  });

  it('shows contact information', () => {
    render(<CustomerHeader customer={mockCustomerWithRelations} />);

    // Phone appears in both Phone and WhatsApp fields
    expect(screen.getAllByText('+263771234567').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('john.moyo@example.com')).toBeInTheDocument();
  });

  it('shows national ID', () => {
    render(<CustomerHeader customer={mockCustomerWithRelations} />);

    expect(screen.getByText('63-1234567-A-01')).toBeInTheDocument();
  });

  it('shows blocked badge when customer is blocked', () => {
    const blockedCustomer = {
      ...mockCustomerWithRelations,
      status: 'blocked' as const,
      blocked_reason: 'Fraud',
    };

    render(<CustomerHeader customer={blockedCustomer} />);

    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('shows customer initials', () => {
    render(<CustomerHeader customer={mockCustomerWithRelations} />);

    expect(screen.getByText('JM')).toBeInTheDocument();
  });

  it('opens menu on click', () => {
    render(<CustomerHeader customer={mockCustomerWithRelations} />);

    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    expect(screen.getByText('Block Customer')).toBeInTheDocument();
  });

  it('shows Unblock when customer is blocked', () => {
    const blockedCustomer = {
      ...mockCustomerWithRelations,
      status: 'blocked' as const,
    };

    render(<CustomerHeader customer={blockedCustomer} />);

    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    expect(screen.getByText('Unblock Customer')).toBeInTheDocument();
  });

  it('calls onBlock callback', () => {
    const onBlock = jest.fn();
    render(
      <CustomerHeader customer={mockCustomerWithRelations} onBlock={onBlock} />
    );

    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);
    fireEvent.click(screen.getByText('Block Customer'));

    expect(onBlock).toHaveBeenCalled();
  });
});
