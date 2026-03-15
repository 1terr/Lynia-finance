import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { DeviceModelForm } from '@/components/products/device-model-form';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/products/device-models',
}));

const mockDeviceModel = {
  id: 'dm-001',
  brand: 'Samsung',
  model_name: 'Galaxy A14',
  model_code: 'SAM_A14',
  storage_gb: 64,
  ram_gb: 4,
  screen_size_inches: 6.6,
  retail_price_usd: 150,
  wholesale_price_usd: 110,
  min_deposit_percentage: 10,
  max_term_months: 12,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('DeviceModelForm', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create form with title "Add Phone Model"', () => {
    render(
      <DeviceModelForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Add Phone Model')).toBeInTheDocument();
  });

  it('renders edit form with pre-populated fields', () => {
    render(
      <DeviceModelForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        deviceModel={mockDeviceModel}
      />
    );

    expect(screen.getByDisplayValue('Samsung')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Galaxy A14')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SAM_A14')).toBeInTheDocument();
    expect(screen.getByDisplayValue('64')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('6.6')).toBeInTheDocument();
    expect(screen.getByDisplayValue('150')).toBeInTheDocument();
    expect(screen.getByDisplayValue('110')).toBeInTheDocument();
  });

  it('validates required fields (brand, modelName, modelCode)', async () => {
    const user = userEvent.setup();
    render(
      <DeviceModelForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/brand.*required/i)).toBeInTheDocument();
      expect(screen.getByText(/model.*name.*required|name.*required/i)).toBeInTheDocument();
      expect(screen.getByText(/model.*code.*required|code.*required/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates retail and wholesale prices > 0', async () => {
    const user = userEvent.setup();
    render(
      <DeviceModelForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    await user.type(screen.getByLabelText(/brand/i), 'Samsung');
    await user.type(screen.getByLabelText(/model.*name|name/i), 'Galaxy A14');
    await user.type(screen.getByLabelText(/model.*code|code/i), 'SAM_A14');

    const retailInput = screen.getByLabelText(/retail.*price/i);
    await user.clear(retailInput);
    await user.type(retailInput, '0');

    const wholesaleInput = screen.getByLabelText(/wholesale.*price/i);
    await user.clear(wholesaleInput);
    await user.type(wholesaleInput, '-5');

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/retail.*price.*greater|price.*must.*positive|price.*greater.*0/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates wholesale must be less than retail', async () => {
    const user = userEvent.setup();
    render(
      <DeviceModelForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    await user.type(screen.getByLabelText(/brand/i), 'Samsung');
    await user.type(screen.getByLabelText(/model.*name|name/i), 'Galaxy A14');
    await user.type(screen.getByLabelText(/model.*code|code/i), 'SAM_A14');

    const retailInput = screen.getByLabelText(/retail.*price/i);
    await user.clear(retailInput);
    await user.type(retailInput, '100');

    const wholesaleInput = screen.getByLabelText(/wholesale.*price/i);
    await user.clear(wholesaleInput);
    await user.type(wholesaleInput, '150');

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/wholesale.*less.*retail|wholesale.*cannot.*exceed|wholesale.*lower/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows margin calculation when prices are valid', async () => {
    const user = userEvent.setup();
    render(
      <DeviceModelForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const retailInput = screen.getByLabelText(/retail.*price/i);
    await user.clear(retailInput);
    await user.type(retailInput, '150');

    const wholesaleInput = screen.getByLabelText(/wholesale.*price/i);
    await user.clear(wholesaleInput);
    await user.type(wholesaleInput, '110');

    await waitFor(() => {
      // Margin = (150 - 110) / 150 * 100 = 26.67%
      expect(screen.getByText(/margin|26\.6/i)).toBeInTheDocument();
    });
  });

  it('disables modelCode in edit mode', () => {
    render(
      <DeviceModelForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        deviceModel={mockDeviceModel}
      />
    );

    const modelCodeInput = screen.getByDisplayValue('SAM_A14');
    expect(modelCodeInput).toBeDisabled();
  });

  it('calls onSubmit with correct data shape', async () => {
    const user = userEvent.setup();
    render(
      <DeviceModelForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    await user.type(screen.getByLabelText(/brand/i), 'Nokia');
    await user.type(screen.getByLabelText(/model.*name|name/i), 'G21');
    await user.type(screen.getByLabelText(/model.*code|code/i), 'NOK_G21');

    const storageInput = screen.getByLabelText(/storage/i);
    await user.clear(storageInput);
    await user.type(storageInput, '128');

    const ramInput = screen.getByLabelText(/ram/i);
    await user.clear(ramInput);
    await user.type(ramInput, '4');

    const retailInput = screen.getByLabelText(/retail.*price/i);
    await user.clear(retailInput);
    await user.type(retailInput, '200');

    const wholesaleInput = screen.getByLabelText(/wholesale.*price/i);
    await user.clear(wholesaleInput);
    await user.type(wholesaleInput, '140');

    const submitButton = screen.getByRole('button', { name: /save|submit|create|add/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    const submittedData = mockOnSubmit.mock.calls[0][0];
    expect(submittedData).toMatchObject({
      brand: 'Nokia',
      model_name: 'G21',
      model_code: 'NOK_G21',
      storage_gb: 128,
      ram_gb: 4,
      retail_price_usd: 200,
      wholesale_price_usd: 140,
    });
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(
      <DeviceModelForm
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
