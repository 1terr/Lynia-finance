import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationWizard } from '@/components/products/organization-wizard';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/products/organizations/new',
}));

// Mock API functions
jest.mock('@/lib/api/products', () => ({
  createOrganization: jest.fn().mockResolvedValue({ id: 'new-org' }),
  updateOrganization: jest.fn().mockResolvedValue({ id: 'org-001' }),
  checkOrgCode: jest.fn().mockResolvedValue({ available: true }),
}));

// Mock toast
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const mockOrg = {
  id: 'org-001',
  org_code: 'GOV_CSC',
  org_name: 'Civil Service Commission',
  org_type: 'government' as const,
  verification_method: 'excel_upload' as const,
  scoring_trust_level: 90,
  contact_name: 'Jane',
  contact_phone: '+263771234567',
  contact_email: 'jane@test.com',
  api_endpoint: null,
  is_active: true,
  total_members: 0,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/**
 * Helper: fill step 1 fields so we can advance to step 2.
 * Uses fireEvent for the select and userEvent for text inputs.
 */
async function fillStep1AndAdvance(user: ReturnType<typeof userEvent.setup>) {
  const orgNameInput = screen.getByLabelText(/organization name/i);
  await user.type(orgNameInput, 'Test Organization');

  // The auto-suggest should fill org_code, but type one explicitly
  const orgCodeInput = screen.getByLabelText(/organization code/i);
  await user.clear(orgCodeInput);
  await user.type(orgCodeInput, 'TEST_ORG');

  const nextButton = screen.getByRole('button', { name: /next/i });
  await user.click(nextButton);

  // Wait for step 2 heading to appear
  await waitFor(() => {
    expect(screen.getByText('Verification & Scoring')).toBeInTheDocument();
  });
}

/**
 * Helper: fill step 1 and step 2, then advance to step 3.
 */
async function fillStep1And2AndAdvance(user: ReturnType<typeof userEvent.setup>) {
  await fillStep1AndAdvance(user);

  // Step 2: defaults are fine, just click Next
  const nextButton = screen.getByRole('button', { name: /next/i });
  await user.click(nextButton);

  await waitFor(() => {
    expect(screen.getByText('Contact Information')).toBeInTheDocument();
  });
}

describe('OrganizationWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders step 1 by default with Organization Identity heading', () => {
    render(<OrganizationWizard />, { wrapper: createWrapper() });

    expect(
      screen.getByRole('heading', { name: /organization identity/i })
    ).toBeInTheDocument();
  });

  it('shows org_code and org_name inputs on step 1', () => {
    render(<OrganizationWizard />, { wrapper: createWrapper() });

    expect(screen.getByLabelText(/organization code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
  });

  it('shows validation error when org_code is empty on Next', async () => {
    const user = userEvent.setup();
    render(<OrganizationWizard />, { wrapper: createWrapper() });

    // Type a name so only code is the issue
    const orgNameInput = screen.getByLabelText(/organization name/i);
    await user.type(orgNameInput, 'Test Org');

    // Clear the auto-suggested code
    const orgCodeInput = screen.getByLabelText(/organization code/i);
    await user.clear(orgCodeInput);

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/organization code is required/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when org_name is empty on Next', async () => {
    const user = userEvent.setup();
    render(<OrganizationWizard />, { wrapper: createWrapper() });

    // Type a code but leave name empty
    const orgCodeInput = screen.getByLabelText(/organization code/i);
    await user.type(orgCodeInput, 'TEST_CODE');

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/organization name is required/i)).toBeInTheDocument();
    });
  });

  it('auto-suggests org_code based on org_type and name', async () => {
    const user = userEvent.setup();
    render(<OrganizationWizard />, { wrapper: createWrapper() });

    // Default org_type is 'corporate', so prefix should be 'ORG'
    const orgNameInput = screen.getByLabelText(/organization name/i);
    await user.type(orgNameInput, 'Zimbabwe Revenue Authority');

    const orgCodeInput = screen.getByLabelText(/organization code/i) as HTMLInputElement;
    // generateOrgCode('corporate', 'Zimbabwe Revenue Authority') => 'ORG_ZRA'
    await waitFor(() => {
      expect(orgCodeInput.value).toBe('ORG_ZRA');
    });
  });

  it('transforms org_code to uppercase on input', async () => {
    const user = userEvent.setup();
    render(<OrganizationWizard />, { wrapper: createWrapper() });

    const orgCodeInput = screen.getByLabelText(/organization code/i) as HTMLInputElement;
    await user.clear(orgCodeInput);
    await user.type(orgCodeInput, 'my_code');

    expect(orgCodeInput.value).toBe('MY_CODE');
  });

  it('shows API endpoint field only when verification method is api', async () => {
    const user = userEvent.setup();
    render(<OrganizationWizard />, { wrapper: createWrapper() });

    await fillStep1AndAdvance(user);

    // Step 2: API endpoint should NOT be visible by default (excel_upload)
    expect(screen.queryByLabelText(/api endpoint/i)).not.toBeInTheDocument();

    // Change verification method to 'api'
    const verificationSelect = screen.getByLabelText(/verification method/i);
    fireEvent.change(verificationSelect, { target: { value: 'api' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/api endpoint/i)).toBeInTheDocument();
    });
  });

  it('validates API endpoint required when method is api', async () => {
    const user = userEvent.setup();
    render(<OrganizationWizard />, { wrapper: createWrapper() });

    await fillStep1AndAdvance(user);

    // Change verification method to 'api'
    const verificationSelect = screen.getByLabelText(/verification method/i);
    fireEvent.change(verificationSelect, { target: { value: 'api' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/api endpoint/i)).toBeInTheDocument();
    });

    // Try to advance to step 3 without filling the endpoint
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/required for api verification/i)).toBeInTheDocument();
    });
  });

  it('auto-sets trust level when org_type changes in create mode', async () => {
    render(<OrganizationWizard />, { wrapper: createWrapper() });

    // Default org_type is 'corporate', trust level should be 70
    const orgTypeSelect = screen.getByLabelText(/organization type/i);

    // Change to government (trust level 90)
    fireEvent.change(orgTypeSelect, { target: { value: 'government' } });

    // We need to navigate to step 2 to see the trust level, but we can
    // also verify by advancing. Let's change to cooperative (50) first
    fireEvent.change(orgTypeSelect, { target: { value: 'cooperative' } });

    // Now fill and advance to step 2 to see the trust level
    const user = userEvent.setup();
    const orgNameInput = screen.getByLabelText(/organization name/i);
    await user.type(orgNameInput, 'Test Coop');

    const orgCodeInput = screen.getByLabelText(/organization code/i);
    await user.clear(orgCodeInput);
    await user.type(orgCodeInput, 'COOP_TEST');

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Verification & Scoring')).toBeInTheDocument();
    });

    // Trust level should be 50 for cooperative
    const trustSlider = screen.getByLabelText(/scoring trust level/i) as HTMLInputElement;
    expect(trustSlider.value).toBe('50');
  });

  it('does NOT auto-set trust level in edit mode', async () => {
    const user = userEvent.setup();
    render(<OrganizationWizard organization={mockOrg} />, { wrapper: createWrapper() });

    // mockOrg is government with trust level 90
    // Change org_type to cooperative (which would auto-set to 50 in create mode)
    const orgTypeSelect = screen.getByLabelText(/organization type/i);
    fireEvent.change(orgTypeSelect, { target: { value: 'cooperative' } });

    // Navigate to step 2 to check trust level
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Verification & Scoring')).toBeInTheDocument();
    });

    // Trust level should remain 90 (not change to 50)
    const trustSlider = screen.getByLabelText(/scoring trust level/i) as HTMLInputElement;
    expect(trustSlider.value).toBe('90');
  });

  it('disables org_code in edit mode', () => {
    render(<OrganizationWizard organization={mockOrg} />, { wrapper: createWrapper() });

    const orgCodeInput = screen.getByDisplayValue('GOV_CSC');
    expect(orgCodeInput).toBeDisabled();
  });

  it('pre-populates fields in edit mode', async () => {
    const user = userEvent.setup();
    render(<OrganizationWizard organization={mockOrg} />, { wrapper: createWrapper() });

    // Step 1 fields
    expect(screen.getByDisplayValue('GOV_CSC')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Civil Service Commission')).toBeInTheDocument();

    // Navigate to step 2
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Verification & Scoring')).toBeInTheDocument();
    });

    // Trust level should be 90
    const trustSlider = screen.getByLabelText(/scoring trust level/i) as HTMLInputElement;
    expect(trustSlider.value).toBe('90');

    // Navigate to step 3
    const nextButton2 = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton2);

    await waitFor(() => {
      expect(screen.getByText('Contact Information')).toBeInTheDocument();
    });

    // Step 3 fields
    expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+263771234567')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@test.com')).toBeInTheDocument();
  });

  it('shows is_active checkbox only in edit mode', () => {
    // Create mode: no checkbox
    const { unmount } = render(<OrganizationWizard />, { wrapper: createWrapper() });
    expect(screen.queryByRole('checkbox', { name: /active/i })).not.toBeInTheDocument();
    unmount();

    // Edit mode: checkbox should be present
    render(<OrganizationWizard organization={mockOrg} />, { wrapper: createWrapper() });
    expect(screen.getByRole('checkbox', { name: /active/i })).toBeInTheDocument();
  });

  it('shows exit confirmation when cancelling with dirty form', async () => {
    const user = userEvent.setup();
    render(<OrganizationWizard />, { wrapper: createWrapper() });

    // Type something to make the form dirty
    const orgNameInput = screen.getByLabelText(/organization name/i);
    await user.type(orgNameInput, 'Dirty data');

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/discard changes/i)).toBeInTheDocument();
    });
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<OrganizationWizard />, {
      wrapper: createWrapper(),
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
