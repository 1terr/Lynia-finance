import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../Pagination';

describe('Pagination', () => {
  const defaultProps = {
    page: 1,
    limit: 25,
    total: 100,
    onPageChange: jest.fn(),
  };

  it('shows correct range text', () => {
    render(<Pagination {...defaultProps} />);

    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText(/results/)).toBeInTheDocument();
  });

  it('disables Previous button on first page', () => {
    render(<Pagination {...defaultProps} />);

    expect(screen.getByText('Previous')).toBeDisabled();
  });

  it('enables Next button when more pages exist', () => {
    render(<Pagination {...defaultProps} />);

    expect(screen.getByText('Next')).not.toBeDisabled();
  });

  it('calls onPageChange with next page', () => {
    const onPageChange = jest.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with previous page', () => {
    const onPageChange = jest.fn();
    render(
      <Pagination {...defaultProps} page={2} onPageChange={onPageChange} />
    );

    fireEvent.click(screen.getByText('Previous'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables Next on last page', () => {
    render(<Pagination {...defaultProps} page={4} />);

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('renders nothing when total is 0', () => {
    const { container } = render(
      <Pagination {...defaultProps} total={0} />
    );
    expect(container.firstChild).toBeNull();
  });
});
