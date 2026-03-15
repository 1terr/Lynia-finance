import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ReviewHistory } from '@/components/kyc-review/ReviewHistory';

jest.mock('@lynia/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  formatDateTime: (d: string) => new Date(d).toLocaleDateString(),
}));

const approvedReview = {
  id: 'r1',
  submission_id: 's1',
  action: 'approved' as const,
  reason: null,
  notes: 'Looks good',
  reviewed_at: '2026-03-14T10:00:00Z',
  reviewed_by: 'admin-001',
  reviewer: { id: 'admin-001', full_name: 'Admin User', email: 'admin@test.com' },
};

const rejectedReview = {
  id: 'r2',
  submission_id: 's1',
  action: 'rejected' as const,
  reason: 'Document illegible',
  notes: null,
  reviewed_at: '2026-03-13T08:00:00Z',
  reviewed_by: 'admin-002',
  reviewer: { id: 'admin-002', full_name: 'Other Admin', email: 'admin2@test.com' },
};

describe('ReviewHistory', () => {
  it('shows "No previous reviews" when reviews is empty', () => {
    render(<ReviewHistory reviews={[]} />);

    expect(screen.getByText(/No previous reviews/i)).toBeInTheDocument();
  });

  it('shows "No previous reviews" when reviews is empty array', () => {
    render(<ReviewHistory reviews={[]} />);

    expect(screen.getByText(/No previous reviews/i)).toBeInTheDocument();
  });

  it('renders review entries with correct action text', () => {
    render(<ReviewHistory reviews={[approvedReview, rejectedReview]} />);

    expect(screen.getByText(/Approved/i)).toBeInTheDocument();
    expect(screen.getByText(/Rejected/i)).toBeInTheDocument();
  });

  it('shows reviewer name', () => {
    render(<ReviewHistory reviews={[approvedReview, rejectedReview]} />);

    expect(screen.getByText(/Admin User/)).toBeInTheDocument();
    expect(screen.getByText(/Other Admin/)).toBeInTheDocument();
  });

  it('shows rejection reason when present', () => {
    render(<ReviewHistory reviews={[rejectedReview]} />);

    expect(screen.getByText(/Document illegible/)).toBeInTheDocument();
  });

  it('shows notes when present', () => {
    render(<ReviewHistory reviews={[approvedReview]} />);

    expect(screen.getByText(/Looks good/)).toBeInTheDocument();
  });

  it('shows review count in heading', () => {
    render(<ReviewHistory reviews={[approvedReview, rejectedReview]} />);

    expect(screen.getByText(/Review History \(2\)/)).toBeInTheDocument();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(
      <ReviewHistory reviews={[approvedReview, rejectedReview]} />
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
