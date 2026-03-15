import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { OrganizationForm } from '@/components/products/organization-form';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/products/organizations',
}));

const mockOrg = {
  id: 'org-001',
  org_code: 'GOV_CSC',
  org_name: 'Civil Service Commission',
  org_type: 'government' as const,
  verification_method: 'excel_upload' as const,
  scoring_trust_level: 90,
  contact_person: 'Jane',
  contact_phone: '+263771234567',
  contact_email: 'jane@test.com',
  api_endpoint: null,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('OrganizationForm', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create form with title "Add Organization"', () => {
    render(
      <OrganizationForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Organization' })).toBeInTheDocument();
  });

  it('renders edit form with pre-populated fields and title "Edit Organization"', () => {
    render(
      <OrganizationForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        organization={mockOrg}
      />
    );

    expect(screen.getByText('Edit Organization')).toBeInTheDocument();
    expect(screen.getByDisplayValue('GOV_CSC')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Civil Service Commission')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+263771234567')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@test.com')).toBeInTheDocument();
  });

  it('shows validation error when orgCode is empty on submit', async () => {
    const user = userEvent.setup();
    render(
      <OrganizationForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/org.*code.*required|code.*required/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error when orgName is empty on submit', async () => {
    const user = userEvent.setup();
    render(
      <OrganizationForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const orgCodeInput = screen.getByLabelText(/org.*code|code/i);
    await user.type(orgCodeInput, 'TEST_CODE');

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/org.*name.*required|name.*required/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows API endpoint field only when verification method is "api"', async () => {
    render(
      <OrganizationForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.queryByLabelText(/api.*endpoint/i)).not.toBeInTheDocument();

    const verificationSelect = screen.getByLabelText(/verification.*method/i);
    fireEvent.change(verificationSelect, { target: { value: 'api' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/api.*endpoint/i)).toBeInTheDocument();
    });
  });

  it('validates API endpoint required when method is "api"', async () => {
    const user = userEvent.setup();
    render(
      <OrganizationForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const verificationSelect = screen.getByLabelText(/verification.*method/i);
    fireEvent.change(verificationSelect, { target: { value: 'api' } });

    const orgCodeInput = screen.getByLabelText(/org.*code|code/i);
    await user.type(orgCodeInput, 'TEST_CODE');

    const orgNameInput = screen.getByLabelText(/org.*name|name/i);
    await user.type(orgNameInput, 'Test Org');

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/api.*endpoint.*required|endpoint.*required/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('changing org type updates default trust level in create mode', async () => {
    render(
      <OrganizationForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const orgTypeSelect = screen.getByLabelText(/org.*type|type/i);

    // Default is government, trust level 90
    expect(screen.getByDisplayValue('90')).toBeInTheDocument();

    fireEvent.change(orgTypeSelect, { target: { value: 'cooperative' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    });
  });

  it('does NOT update trust level on org type change in edit mode', async () => {
    const user = userEvent.setup();
    render(
      <OrganizationForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        organization={mockOrg}
      />
    );

    expect(screen.getByDisplayValue('90')).toBeInTheDocument();

    const orgTypeSelect = screen.getByLabelText(/org.*type|type/i);
    await user.click(orgTypeSelect);

    const cooperativeOption = await screen.findByRole('option', { name: /cooperative/i });
    await user.click(cooperativeOption);

    expect(screen.getByDisplayValue('90')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('50')).not.toBeInTheDocument();
  });

  it('disables orgCode input in edit mode', () => {
    render(
      <OrganizationForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        organization={mockOrg}
      />
    );

    const orgCodeInput = screen.getByDisplayValue('GOV_CSC');
    expect(orgCodeInput).toBeDisabled();
  });

  it('calls onSubmit with correct data shape and calls onClose after', async () => {
    const user = userEvent.setup();
    render(
      <OrganizationForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    await user.type(screen.getByLabelText(/org.*code|code/i), 'NEW_ORG');
    await user.type(screen.getByLabelText(/org.*name|name/i), 'New Organization');

    const orgTypeSelect = screen.getByLabelText(/org.*type|type/i);
    fireEvent.change(orgTypeSelect, { target: { value: 'corporate' } });

    await user.type(screen.getByLabelText(/contact.*person/i), 'John Doe');
    await user.type(screen.getByLabelText(/contact.*phone/i), '+263770000000');
    await user.type(screen.getByLabelText(/contact.*email/i), 'john@test.com');

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = mockOnSubmit.mock.calls[0][0];
    expect(submittedData).toMatchObject({
      org_code: 'NEW_ORG',
      org_name: 'New Organization',
      org_type: 'corporate',
      contact_person: 'John Doe',
      contact_phone: '+263770000000',
      contact_email: 'john@test.com',
    });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(
      <OrganizationForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
