import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';

jest.mock('@lynia/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import { PaymentFilters } from '@/components/payments/PaymentFilters';

describe('PaymentFilters', () => {
  const defaultFilters = {
    status: '',
    payment_method: '',
    payment_type: '',
    date_from: '',
    date_to: '',
  };
  const defaultProps = {
    filters: defaultFilters,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders status filter with All Statuses default', () => {
    render(<PaymentFilters {...defaultProps} />);
    expect(screen.getByDisplayValue('All Statuses')).toBeInTheDocument();
  });

  it('renders payment method filter', () => {
    render(<PaymentFilters {...defaultProps} />);
    expect(screen.getByDisplayValue('All Methods')).toBeInTheDocument();
  });

  it('renders payment type filter', () => {
    render(<PaymentFilters {...defaultProps} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(3);
  });

  it('renders date range inputs', () => {
    render(<PaymentFilters {...defaultProps} />);
    const dateInputs = screen.getAllByDisplayValue('');
    const dateFields = dateInputs.filter(
      (input) => (input as HTMLInputElement).type === 'date'
    );
    expect(dateFields).toHaveLength(2);
  });

  it('calls onChange with status when status filter changes', () => {
    render(<PaymentFilters {...defaultProps} />);
    const statusSelect = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusSelect, { target: { value: 'confirmed' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed' })
    );
  });

  it('calls onChange with payment_method when method filter changes', () => {
    render(<PaymentFilters {...defaultProps} />);
    const methodSelect = screen.getByDisplayValue('All Methods');
    fireEvent.change(methodSelect, { target: { value: 'ecocash' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'ecocash' })
    );
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<PaymentFilters {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
