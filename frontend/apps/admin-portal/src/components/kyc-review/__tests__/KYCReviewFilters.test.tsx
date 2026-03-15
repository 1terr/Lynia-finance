import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { KYCReviewFilters } from '@/components/kyc-review/KYCReviewFilters';

describe('KYCReviewFilters', () => {
  const defaultFilters = {
    status: '' as const,
    confidenceRange: '' as const,
    sortBy: 'submitted_at' as const,
    sortOrder: 'asc' as const,
  };

  const mockOnFilterChange = jest.fn();

  beforeEach(() => {
    mockOnFilterChange.mockClear();
  });

  it('renders status filter with options', () => {
    render(
      <KYCReviewFilters
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.getByText('All Statuses')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('In Review')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('renders confidence range filter', () => {
    render(
      <KYCReviewFilters
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.getByText('All Confidence')).toBeInTheDocument();
    expect(screen.getByText('High (85%+)')).toBeInTheDocument();
    expect(screen.getByText('Medium (50-84%)')).toBeInTheDocument();
    expect(screen.getByText('Low (<50%)')).toBeInTheDocument();
  });

  it('renders sort control with options', () => {
    render(
      <KYCReviewFilters
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.getByText('Oldest First')).toBeInTheDocument();
    expect(screen.getByText('Newest First')).toBeInTheDocument();
  });

  it('calls onFilterChange with status when status changes', () => {
    render(
      <KYCReviewFilters
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    const statusSelect = screen.getByRole('combobox', { name: /status/i });

    fireEvent.change(statusSelect, { target: { value: 'pending' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' })
    );
  });

  it('calls onFilterChange with confidence range when changed', () => {
    render(
      <KYCReviewFilters
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    const selects = screen.getAllByRole('combobox');
    const confidenceSelect = selects[1];

    fireEvent.change(confidenceSelect, { target: { value: 'high' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ confidenceRange: 'high' })
    );
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(
      <KYCReviewFilters
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
      />
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
