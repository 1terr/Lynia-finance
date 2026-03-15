import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { renderWithProviders } from '@/test/helpers';
import { ProductForm } from '@/components/products/product-form';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/products',
}));

jest.mock('@/lib/api/fineract', () => ({
  getFineractLoanProducts: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

describe('ProductForm', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create form with title "Create Product"', () => {
    renderWithProviders(
      <ProductForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByRole('heading', { name: 'Create Product' })).toBeInTheDocument();
  });

  it('validates required fields (name, code)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProductForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name.*required/i)).toBeInTheDocument();
      expect(screen.getByText(/code.*required/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates product code format (alphanumeric + underscores only)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProductForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    await user.type(screen.getByLabelText(/name/i), 'Test Product');

    const codeInput = screen.getByLabelText(/code/i);
    await user.type(codeInput, 'invalid-code!@#');

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/alphanumeric|invalid.*code.*format|letters.*numbers.*underscores/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates min amount < max amount', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProductForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    await user.type(screen.getByLabelText(/name/i), 'Test Product');
    await user.type(screen.getByLabelText(/code/i), 'TEST_PROD');

    const minAmountInput = screen.getByLabelText(/min.*amount/i);
    await user.clear(minAmountInput);
    await user.type(minAmountInput, '500');

    const maxAmountInput = screen.getByLabelText(/max.*amount/i);
    await user.clear(maxAmountInput);
    await user.type(maxAmountInput, '100');

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/min.*amount.*less.*max|min.*cannot.*exceed.*max|min.*must.*lower/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates min term < max term', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProductForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    await user.type(screen.getByLabelText(/product name/i), 'Test Product');
    await user.type(screen.getByLabelText(/product code/i), 'TEST_PROD');

    const minTermInput = screen.getByLabelText(/min tenure/i);
    await user.clear(minTermInput);
    await user.type(minTermInput, '24');

    const maxTermInput = screen.getByLabelText(/max tenure/i);
    await user.clear(maxTermInput);
    await user.type(maxTermInput, '6');

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/min tenure must be less than max tenure/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows deposit fields for smartphone category', async () => {
    renderWithProviders(
      <ProductForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    // Default category is 'smartphone', so deposit fields should already be visible
    const categorySelect = screen.getByLabelText(/category/i);
    fireEvent.change(categorySelect, { target: { value: 'smartphone' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/deposit percentage/i)).toBeInTheDocument();
    });
  });

  it('shows disbursement methods for digital category', async () => {
    renderWithProviders(
      <ProductForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const categorySelect = screen.getByLabelText(/category/i);
    fireEvent.change(categorySelect, { target: { value: 'digital' } });

    await waitFor(() => {
      expect(screen.getByText(/disbursement/i)).toBeInTheDocument();
    });
  });

  it('monthly rate change auto-calculates annual rate', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProductForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const monthlyRateInput = screen.getByLabelText(/interest rate.*month/i);
    await user.clear(monthlyRateInput);
    await user.type(monthlyRateInput, '5');

    await waitFor(() => {
      const annualRateInput = screen.getByLabelText(/interest rate.*year/i);
      // 5% monthly * 12 = 60% annual
      expect(annualRateInput).toHaveValue(60);
    });
  });

  it('calls onSubmit with correct data and calls onClose', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProductForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    await user.type(screen.getByLabelText(/product name/i), 'Smartphone Loan');
    await user.type(screen.getByLabelText(/product code/i), 'SMART_LOAN_01');

    const monthlyRateInput = screen.getByLabelText(/interest rate.*month/i);
    await user.clear(monthlyRateInput);
    await user.type(monthlyRateInput, '5');

    const minAmountInput = screen.getByLabelText(/min amount/i);
    await user.clear(minAmountInput);
    await user.type(minAmountInput, '50');

    const maxAmountInput = screen.getByLabelText(/max amount/i);
    await user.clear(maxAmountInput);
    await user.type(maxAmountInput, '500');

    const minTermInput = screen.getByLabelText(/min tenure/i);
    await user.clear(minTermInput);
    await user.type(minTermInput, '3');

    const maxTermInput = screen.getByLabelText(/max tenure/i);
    await user.clear(maxTermInput);
    await user.type(maxTermInput, '12');

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = mockOnSubmit.mock.calls[0][0];
    expect(submittedData).toMatchObject({
      product_name: 'Smartphone Loan',
      product_code: 'SMART_LOAN_01',
      interest_rate_monthly: 5,
      min_amount_usd: 50,
      max_amount_usd: 500,
      min_term_months: 3,
      max_term_months: 12,
    });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('passes axe accessibility checks', async () => {
    const { container } = renderWithProviders(
      <ProductForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
