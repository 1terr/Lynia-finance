import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import ProfilePage from '@/app/(dashboard)/profile/_client';
import { useAuthStore } from '@/lib/store/auth-store';
import * as apiClient from '@/lib/api';
import {
  createDistributor,
  resetFactoryCounters,
} from '@/__tests__/fixtures/factories';

// Mock the auth store
jest.mock('@/lib/store/auth-store');

// Mock the API client
jest.mock('@/lib/api', () => ({
  updateDistributorProfile: jest.fn(),
}));

describe('ProfilePage', () => {
  const mockDistributor = createDistributor({
    name: 'John Doe',
    phone_number: '+263771234567',
    email: 'john@lynia.co.zw',
    national_id: '63-123456A78',
    business_name: 'John Doe Electronics',
    address: '123 Main St, Harare',
    status: 'active',
    kyc_status: 'approved',
    average_rating: 4.7,
  });

  const mockSetDistributor = jest.fn();
  const mockLogout = jest.fn();

  beforeEach(() => {
    resetFactoryCounters();
    jest.clearAllMocks();

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      distributor: mockDistributor,
      setDistributor: mockSetDistributor,
      logout: mockLogout,
    });
  });

  describe('Initial Render', () => {
    it('renders profile page with distributor data', () => {
      render(<ProfilePage />);

      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();
      expect(screen.getAllByText('John Doe Electronics')[0]).toBeInTheDocument();
      expect(screen.getByText('+263771234567')).toBeInTheDocument();
      expect(screen.getByText('john@lynia.co.zw')).toBeInTheDocument();
      expect(screen.getByText('63-123456A78')).toBeInTheDocument();
    });

    it('displays status badges correctly', () => {
      render(<ProfilePage />);

      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('KYC approved')).toBeInTheDocument();
    });

    it('displays average rating', () => {
      render(<ProfilePage />);

      expect(screen.getByText('4.7')).toBeInTheDocument();
    });

    it('shows Edit Profile button', () => {
      render(<ProfilePage />);

      expect(
        screen.getByRole('button', { name: /Edit Profile/i })
      ).toBeInTheDocument();
    });

    it('returns null when no distributor is loaded', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        distributor: null,
        setDistributor: mockSetDistributor,
        logout: mockLogout,
      });

      const { container } = render(<ProfilePage />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Edit Mode', () => {
    it('enters edit mode when Edit Profile is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('shows form inputs in edit mode', async () => {
      const user = userEvent.setup();
      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      // Phone number input should be visible (first input with this placeholder)
      const phoneInputs = screen.getAllByPlaceholderText('+263771234567');
      expect(phoneInputs[0]).toBeInTheDocument();
      expect(phoneInputs[0]).toHaveValue('+263771234567');
    });

    it('exits edit mode when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));
      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
    });

    it('resets form values when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      // Modify phone number (first input with this placeholder)
      const phoneInputs = screen.getAllByPlaceholderText('+263771234567');
      await user.clear(phoneInputs[0]);
      await user.type(phoneInputs[0], '+263779999999');

      // Cancel changes
      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      // Re-enter edit mode
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      // Phone number should be reset to original value
      const resetPhoneInputs = screen.getAllByPlaceholderText('+263771234567');
      expect(resetPhoneInputs[0]).toHaveValue('+263771234567');
    });
  });

  describe('Form Validation', () => {
    it('validates phone number format', async () => {
      const user = userEvent.setup();
      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      const phoneInputs = screen.getAllByPlaceholderText('+263771234567');
      await user.clear(phoneInputs[0]);
      await user.type(phoneInputs[0], '123456');

      // Trigger form submission to show validation errors
      await user.click(screen.getByRole('button', { name: /Save/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/Phone must be \+263 followed by 9 digits/i)
        ).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('accepts valid Zimbabwe phone number', async () => {
      const user = userEvent.setup();
      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      const phoneInputs = screen.getAllByPlaceholderText('+263771234567');
      await user.clear(phoneInputs[0]);
      await user.type(phoneInputs[0], '+263779999999');

      await waitFor(() => {
        expect(
          screen.queryByText(/Phone must be \+263 followed by 9 digits/i)
        ).not.toBeInTheDocument();
      });
    });

    it('accepts empty phone number (optional field)', async () => {
      const user = userEvent.setup();
      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      const phoneInputs = screen.getAllByPlaceholderText('+263771234567');
      await user.clear(phoneInputs[0]);

      await waitFor(() => {
        expect(
          screen.queryByText(/Phone must be \+263 followed by 9 digits/i)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      const updatedDistributor = { ...mockDistributor, phone_number: '+263779999999' };
      (apiClient.updateDistributorProfile as jest.Mock).mockResolvedValue(updatedDistributor);

      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      const phoneInputs = screen.getAllByPlaceholderText('+263771234567');
      await user.clear(phoneInputs[0]);
      await user.type(phoneInputs[0], '+263779999999');

      await user.click(screen.getByRole('button', { name: /Save/i }));

      await waitFor(() => {
        expect(apiClient.updateDistributorProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            phone_number: '+263779999999',
          })
        );
      });
    });

    it('updates store with new distributor data after successful save', async () => {
      const user = userEvent.setup();
      const updatedDistributor = { ...mockDistributor, phone_number: '+263779999999' };
      (apiClient.updateDistributorProfile as jest.Mock).mockResolvedValue(updatedDistributor);

      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      const phoneInputs = screen.getAllByPlaceholderText('+263771234567');
      await user.clear(phoneInputs[0]);
      await user.type(phoneInputs[0], '+263779999999');

      await user.click(screen.getByRole('button', { name: /Save/i }));

      await waitFor(() => {
        expect(mockSetDistributor).toHaveBeenCalledWith(updatedDistributor);
      });
    });

    it('exits edit mode after successful save', async () => {
      const user = userEvent.setup();
      (apiClient.updateDistributorProfile as jest.Mock).mockResolvedValue(mockDistributor);

      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));
      await user.click(screen.getByRole('button', { name: /Save/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument();
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      (apiClient.updateDistributorProfile as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDistributor), 100))
      );

      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));
      await user.click(screen.getByRole('button', { name: /Save/i }));

      expect(screen.getByText('Saving...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
      });
    });

    it('disables Save and Cancel buttons during submission', async () => {
      const user = userEvent.setup();
      (apiClient.updateDistributorProfile as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDistributor), 100))
      );

      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      const saveButton = screen.getByRole('button', { name: /Save/i });
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });

      await user.click(saveButton);

      expect(saveButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Read-only fields', () => {
    it('does not allow editing of name', async () => {
      const user = userEvent.setup();
      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      // Name should be displayed as text, not an input
      const nameElements = screen.getAllByText('John Doe');
      expect(nameElements[0].tagName).not.toBe('INPUT');
    });

    it('does not allow editing of national ID', async () => {
      const user = userEvent.setup();
      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      // National ID should be displayed as text, not an input
      const idElement = screen.getByText('63-123456A78');
      expect(idElement.tagName).not.toBe('INPUT');
    });

    it('does not allow editing of email', async () => {
      const user = userEvent.setup();
      render(<ProfilePage />);

      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

      // Email should be displayed as text, not an input
      const emailElement = screen.getByText('john@lynia.co.zw');
      expect(emailElement.tagName).not.toBe('INPUT');
    });
  });
});
