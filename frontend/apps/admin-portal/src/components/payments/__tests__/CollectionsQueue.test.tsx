import React from 'react';
import { render, screen } from '@testing-library/react';
import { CollectionsQueue } from '../CollectionsQueue';
import { mockCollectionItems } from '@/test/mocks/payments';

describe('CollectionsQueue', () => {
  it('renders collection items', () => {
    render(
      <CollectionsQueue items={mockCollectionItems} isLoading={false} />
    );

    expect(screen.getByText('Tendai Masara')).toBeInTheDocument();
    expect(screen.getByText('Blessing Chipo')).toBeInTheDocument();
    expect(screen.getByText('Tatenda Nyoni')).toBeInTheDocument();
  });

  it('shows priority badges', () => {
    render(
      <CollectionsQueue items={mockCollectionItems} isLoading={false} />
    );

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('shows amount due', () => {
    render(
      <CollectionsQueue items={mockCollectionItems} isLoading={false} />
    );

    expect(screen.getByText('$170.64')).toBeInTheDocument();
    expect(screen.getByText('$56.88')).toBeInTheDocument();
    expect(screen.getByText('$113.76')).toBeInTheDocument();
  });

  it('shows days overdue', () => {
    render(
      <CollectionsQueue items={mockCollectionItems} isLoading={false} />
    );

    expect(screen.getByText('75 days')).toBeInTheDocument();
    expect(screen.getByText('20 days')).toBeInTheDocument();
    expect(screen.getByText('45 days')).toBeInTheDocument();
  });

  it('shows missed payments count', () => {
    render(
      <CollectionsQueue items={mockCollectionItems} isLoading={false} />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows phone numbers (masked)', () => {
    render(
      <CollectionsQueue items={mockCollectionItems} isLoading={false} />
    );

    // Phone numbers are now masked for privacy
    const phoneElements = screen.getAllByText(/\+263/);
    expect(phoneElements.length).toBeGreaterThanOrEqual(2);
  });

  it('shows loading state', () => {
    render(<CollectionsQueue items={[]} isLoading={true} />);

    expect(
      screen.getByText('Loading collections queue...')
    ).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(<CollectionsQueue items={[]} isLoading={false} />);

    expect(screen.getByText('No overdue loans')).toBeInTheDocument();
  });

  it('highlights critical items', () => {
    render(
      <CollectionsQueue items={mockCollectionItems} isLoading={false} />
    );

    const criticalRow = screen.getByText('Tendai Masara').closest('tr');
    expect(criticalRow?.className).toContain('bg-red-50');
  });
});
