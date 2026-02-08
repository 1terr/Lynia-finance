import React from 'react';
import { render, screen } from '@testing-library/react';
import { CustomerOverview } from '../CustomerOverview';
import { mockCustomerWithRelations } from '@/test/mocks/customers';

describe('CustomerOverview', () => {
  it('renders overview section', () => {
    render(<CustomerOverview customer={mockCustomerWithRelations} />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('shows personal information', () => {
    render(<CustomerOverview customer={mockCustomerWithRelations} />);

    expect(screen.getByText('Personal Information')).toBeInTheDocument();
    expect(screen.getByText('male')).toBeInTheDocument();
  });

  it('shows employment info', () => {
    render(<CustomerOverview customer={mockCustomerWithRelations} />);

    expect(screen.getByText('Employment')).toBeInTheDocument();
    expect(screen.getByText('$450.00')).toBeInTheDocument();
  });

  it('shows stats cards', () => {
    render(<CustomerOverview customer={mockCustomerWithRelations} />);

    expect(screen.getByText('Total Loans')).toBeInTheDocument();
    expect(screen.getByText('Active Loans')).toBeInTheDocument();
    expect(screen.getByText('Total Borrowed')).toBeInTheDocument();
    expect(screen.getByText('Total Repaid')).toBeInTheDocument();
  });

  it('shows total loans count', () => {
    render(<CustomerOverview customer={mockCustomerWithRelations} />);

    expect(screen.getByText('3')).toBeInTheDocument(); // total_loans
  });

  it('shows active loans count', () => {
    render(<CustomerOverview customer={mockCustomerWithRelations} />);

    expect(screen.getByText('1')).toBeInTheDocument(); // active_loans
  });

  it('shows address', () => {
    render(<CustomerOverview customer={mockCustomerWithRelations} />);

    expect(screen.getByText('123 Main Street, Harare, Harare')).toBeInTheDocument();
  });
});
