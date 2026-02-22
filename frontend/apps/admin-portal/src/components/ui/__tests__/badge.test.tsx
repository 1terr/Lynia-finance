import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from '../badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies green variant styles', () => {
    render(<Badge variant="green">Verified</Badge>);
    const badge = screen.getByText('Verified');
    expect(badge.className).toContain('bg-green-100');
    expect(badge.className).toContain('text-green-800');
  });

  it('applies red variant styles', () => {
    render(<Badge variant="red">Rejected</Badge>);
    const badge = screen.getByText('Rejected');
    expect(badge.className).toContain('bg-red-100');
    expect(badge.className).toContain('text-red-800');
  });

  it('applies yellow variant styles', () => {
    render(<Badge variant="yellow">Pending</Badge>);
    const badge = screen.getByText('Pending');
    expect(badge.className).toContain('bg-yellow-100');
  });

  it('defaults to gray variant', () => {
    render(<Badge>Unknown</Badge>);
    const badge = screen.getByText('Unknown');
    expect(badge.className).toContain('bg-gray-100');
  });

  it('accepts custom className', () => {
    render(<Badge className="custom-class">Test</Badge>);
    const badge = screen.getByText('Test');
    expect(badge.className).toContain('custom-class');
  });
});
