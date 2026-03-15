import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { KYCReviewCard } from '@/components/kyc-review/KYCReviewCard';

jest.mock('@lynia/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  formatDateTime: (d: string) => 'Mar 14, 2026',
  getConfidenceLevel: (score: number) => ({ label: 'High', color: 'green' as const }),
  maskPhone: (p: string) => '+263****567',
  maskId: (id: string) => '63*****01',
}));

jest.mock('@/lib/hooks/useKYCReview', () => ({
  useKYCActions: () => ({
    approveMutation: { mutate: jest.fn(), isPending: false },
    rejectMutation: { mutate: jest.fn(), isPending: false },
  }),
}));

jest.mock('@/components/kyc-review/DocumentViewer', () => ({
  DocumentViewer: () => <div data-testid="document-viewer">DocumentViewer</div>,
}));

jest.mock('@/components/kyc-review/SLAIndicator', () => ({
  SLAIndicator: ({ compact }: { compact?: boolean }) => (
    <div data-testid={compact ? 'sla-compact' : 'sla-full'}>SLA</div>
  ),
}));

jest.mock('@/components/kyc-review/ReviewHistory', () => ({
  ReviewHistory: () => <div data-testid="review-history">ReviewHistory</div>,
}));

jest.mock('@/components/ui/confirmation-dialog', () => ({
  ConfirmationDialog: ({ open, title }: { open: boolean; title: string }) =>
    open ? <div data-testid="confirm-dialog">{title}</div> : null,
}));

const mockSubmission = {
  id: 'kyc-001',
  customer_id: 'cust-001',
  submission_number: 'KYC-2026-0001',
  attempt_number: 1,
  status: 'pending',
  confidence_score: 88,
  verification_confidence: 88,
  verification_decision: null,
  face_match_score: 92,
  liveness_score: 85,
  id_document_url: 'https://example.com/id.jpg',
  selfie_url: 'https://example.com/selfie.jpg',
  id_document_type: 'National ID',
  id_number: '63-1234567-A-01',
  extracted_name: 'John Moyo',
  extracted_id_number: '63-1234567-A-01',
  extracted_dob: '1990-05-15',
  kyc_provider: 'didit',
  provider_response: {
    face_match: true,
    liveness_check: true,
    id_validation: true,
    confidence: 88,
  },
  submitted_at: '2026-03-14T10:00:00Z',
  created_at: '2026-03-14T10:00:00Z',
  updated_at: '2026-03-14T10:00:00Z',
  customers: {
    id: 'cust-001',
    first_name: 'John',
    last_name: 'Moyo',
    phone_number: '+263771234567',
    email: 'john@test.com',
    city: 'Harare',
    province: 'Harare',
  },
  kyc_manual_reviews: [],
};

const mockOnActionComplete = jest.fn();

describe('KYCReviewCard', () => {
  beforeEach(() => {
    mockOnActionComplete.mockClear();
  });

  it('renders collapsed card with customer name', () => {
    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
      />
    );

    expect(screen.getByText(/John Moyo/)).toBeInTheDocument();
  });

  it('shows submission number', () => {
    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
      />
    );

    expect(screen.getByText(/KYC-2026-0001/)).toBeInTheDocument();
  });

  it('shows confidence score badge', () => {
    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
      />
    );

    expect(screen.getByText(/88%/)).toBeInTheDocument();
  });

  it('shows "Review" button in collapsed state', () => {
    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
      />
    );

    expect(screen.getByRole('button', { name: /Review/i })).toBeInTheDocument();
  });

  it('shows expanded content with DocumentViewer and SLAIndicator when expanded', () => {
    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
        expanded
      />
    );

    expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    expect(
      screen.getByTestId('sla-full') || screen.getByTestId('sla-compact')
    ).toBeTruthy();
  });

  it('clicking Review button expands the card', async () => {
    const user = userEvent.setup();

    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
      />
    );

    const reviewButton = screen.getByRole('button', { name: /Review/i });
    await user.click(reviewButton);

    expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
  });

  it('shows Approve and Reject buttons when expanded', () => {
    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
        expanded
      />
    );

    expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
  });

  it('clicking Reject shows rejection form with reason templates', async () => {
    const user = userEvent.setup();

    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
        expanded
      />
    );

    const rejectButton = screen.getByRole('button', { name: /Reject/i });
    await user.click(rejectButton);

    // Should show a textarea or form for rejection reason
    expect(
      screen.getByRole('textbox') || screen.getByPlaceholderText(/reason/i)
    ).toBeTruthy();
  });

  it('clicking a rejection template appends text to textarea', async () => {
    const user = userEvent.setup();

    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
        expanded
      />
    );

    const rejectButton = screen.getByRole('button', { name: /Reject/i });
    await user.click(rejectButton);

    // Click a specific template button by its exact text
    const templateButton = screen.getByRole('button', { name: 'Document illegible' });
    await user.click(templateButton);

    const textarea = screen.getByRole('textbox');
    expect((textarea as HTMLTextAreaElement).value).toBe('Document illegible');
  });

  it('Confirm Rejection button is disabled when reason is empty', async () => {
    const user = userEvent.setup();

    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
        expanded
      />
    );

    const rejectButton = screen.getByRole('button', { name: /Reject/i });
    await user.click(rejectButton);

    const confirmButton = screen.getByRole('button', {
      name: /Confirm Rejection/i,
    });
    expect(confirmButton).toBeDisabled();
  });

  it('clicking Cancel in rejection form returns to approve/reject buttons', async () => {
    const user = userEvent.setup();

    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
        expanded
      />
    );

    const rejectButton = screen.getByRole('button', { name: /Reject/i });
    await user.click(rejectButton);

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
  });

  it('clicking Approve shows confirmation dialog', async () => {
    const user = userEvent.setup();

    render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
        expanded
      />
    );

    const approveButton = screen.getByRole('button', { name: /Approve/i });
    await user.click(approveButton);

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(
      <KYCReviewCard
        submission={mockSubmission}
        onActionComplete={mockOnActionComplete}
        expanded
      />
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
