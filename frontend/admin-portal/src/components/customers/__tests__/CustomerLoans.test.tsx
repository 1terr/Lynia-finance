import React from 'react';
import { render, screen } from '@testing-library/react';
import { CustomerLoans } from '../CustomerLoans';
import { mockLoan } from '@/test/mocks/customers';

describe('CustomerLoans', () => {
  it('renders loan table', () => {
    render(<CustomerLoans loans={[mockLoan]} />);

    expect(screen.getByText('Loan History (1)')).toBeInTheDocument();
  });

  it('shows loan principal', () => {
    render(<CustomerLoans loans={[mockLoan]} />);

    expect(screen.getByText('$350.00')).toBeInTheDocument();
  });

  it('shows loan status badge', () => {
    render(<CustomerLoans loans={[mockLoan]} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows monthly payment', () => {
    render(<CustomerLoans loans={[mockLoan]} />);

    expect(screen.getByText('$56.88')).toBeInTheDocument();
  });

  it('shows empty state when no loans', () => {
    render(<CustomerLoans loans={[]} />);

    expect(screen.getByText('No loans found')).toBeInTheDocument();
  });

  it('shows detailed columns when detailed prop is true', () => {
    render(<CustomerLoans loans={[mockLoan]} detailed />);

    expect(screen.getByText('Outstanding')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Missed')).toBeInTheDocument();
  });

  it('does not show detailed columns by default', () => {
    render(<CustomerLoans loans={[mockLoan]} />);

    expect(screen.queryByText('Outstanding')).not.toBeInTheDocument();
  });

  it('shows loan ID prefix', () => {
    render(<CustomerLoans loans={[mockLoan]} />);

    expect(screen.getByText(mockLoan.id.slice(0, 8))).toBeInTheDocument();
  });
});
