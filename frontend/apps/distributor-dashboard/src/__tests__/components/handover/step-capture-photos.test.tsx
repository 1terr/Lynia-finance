import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { StepCapturePhotos } from '@/components/handover/step-capture-photos';

// Mock Image so that compressImage resolves immediately
beforeAll(() => {
  // Override the global Image class to fire onload synchronously
  const OriginalImage = global.Image;
  (global as any).Image = class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 300;
    height = 400;
    private _src = '';
    get src() { return this._src; }
    set src(val: string) {
      this._src = val;
      // Immediately fire onerror so compressImage returns the original dataUrl
      setTimeout(() => this.onerror?.(), 0);
    }
  };
});

describe('StepCapturePhotos', () => {
  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders instruction text', () => {
      render(<StepCapturePhotos photos={[]} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/Take photos of the device from multiple angles/i)).toBeInTheDocument();
      expect(screen.getByText(/At least 2 photos are required/i)).toBeInTheDocument();
    });

    it('renders all 4 photo slots', () => {
      render(<StepCapturePhotos photos={[]} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('Front View')).toBeInTheDocument();
      expect(screen.getByText('Back View')).toBeInTheDocument();
      expect(screen.getByText('Screen On')).toBeInTheDocument();
      expect(screen.getByText('Serial Label')).toBeInTheDocument();
    });

    it('renders capture buttons for each slot', () => {
      render(<StepCapturePhotos photos={[]} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('Screen facing camera')).toBeInTheDocument();
      expect(screen.getByText('Back panel visible')).toBeInTheDocument();
      expect(screen.getByText('Device powered on, home screen visible')).toBeInTheDocument();
      expect(screen.getByText('IMEI/serial sticker visible')).toBeInTheDocument();
    });
  });

  describe('Photo Capture', () => {
    it('captures photo for first slot when clicked', async () => {
      const user = userEvent.setup();
      render(<StepCapturePhotos photos={[]} onUpdate={mockOnUpdate} />);

      const frontViewButton = screen.getByText('Screen facing camera').closest('button');
      await user.click(frontViewButton!);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled();
      });
      const callArg = mockOnUpdate.mock.calls[0][0];
      expect(callArg[0]).toContain('data:image/svg+xml');
      // The label is URL-encoded in the SVG data URL
      expect(callArg[0]).toContain('Front%20View');
    });

    it('captures photo for second slot when clicked', async () => {
      const user = userEvent.setup();
      render(<StepCapturePhotos photos={[]} onUpdate={mockOnUpdate} />);

      const backViewButton = screen.getByText('Back panel visible').closest('button');
      await user.click(backViewButton!);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled();
      });
      const callArg = mockOnUpdate.mock.calls[0][0];
      expect(callArg[1]).toContain('data:image/svg+xml');
      expect(callArg[1]).toContain('Back%20View');
    });

    it('captures photo for third slot when clicked', async () => {
      const user = userEvent.setup();
      render(<StepCapturePhotos photos={[]} onUpdate={mockOnUpdate} />);

      const screenOnButton = screen.getByText('Device powered on, home screen visible').closest('button');
      await user.click(screenOnButton!);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled();
      });
      const callArg = mockOnUpdate.mock.calls[0][0];
      expect(callArg[2]).toContain('data:image/svg+xml');
      expect(callArg[2]).toContain('Screen%20On');
    });
  });

  describe('Photo Display', () => {
    const mockPhotos = [
      'data:image/svg+xml,test1',
      'data:image/svg+xml,test2',
      '',
    ];

    it('shows captured photos', () => {
      render(<StepCapturePhotos photos={mockPhotos} onUpdate={mockOnUpdate} />);

      const capturedLabels = screen.getAllByText('Captured');
      expect(capturedLabels).toHaveLength(2);
    });

    it('shows remove button for captured photos', () => {
      const { container } = render(<StepCapturePhotos photos={mockPhotos} onUpdate={mockOnUpdate} />);

      // Remove buttons have aria-label "Remove X photo"
      const removeButtons = screen.getAllByRole('button', { name: /Remove .* photo/i });
      expect(removeButtons.length).toBeGreaterThan(0);
    });

    it('shows capture button for empty slots', () => {
      render(<StepCapturePhotos photos={mockPhotos} onUpdate={mockOnUpdate} />);

      // Third and fourth slots should still show capture buttons
      expect(screen.getByText('Device powered on, home screen visible')).toBeInTheDocument();
      expect(screen.getByText('IMEI/serial sticker visible')).toBeInTheDocument();
    });
  });

  describe('Photo Removal', () => {
    const mockPhotos = [
      'data:image/svg+xml,test1',
      'data:image/svg+xml,test2',
      'data:image/svg+xml,test3',
    ];

    it('removes first photo when X button is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<StepCapturePhotos photos={mockPhotos} onUpdate={mockOnUpdate} />);

      // Find all remove buttons (X icons in red circles)
      const removeButtons = container.querySelectorAll('.bg-red-500');
      expect(removeButtons.length).toBe(3);

      await user.click(removeButtons[0] as HTMLElement);

      expect(mockOnUpdate).toHaveBeenCalled();
      const callArg = mockOnUpdate.mock.calls[0][0];
      expect(callArg[0]).toBe('');
    });

    it('removes second photo when X button is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<StepCapturePhotos photos={mockPhotos} onUpdate={mockOnUpdate} />);

      const removeButtons = container.querySelectorAll('.bg-red-500');
      await user.click(removeButtons[1] as HTMLElement);

      expect(mockOnUpdate).toHaveBeenCalled();
      const callArg = mockOnUpdate.mock.calls[0][0];
      expect(callArg[1]).toBe('');
    });

    it('filters out empty strings after removal', async () => {
      const user = userEvent.setup();
      const singlePhoto = ['data:image/svg+xml,test1', '', ''];

      const { container } = render(<StepCapturePhotos photos={singlePhoto} onUpdate={mockOnUpdate} />);

      const removeButtons = container.querySelectorAll('.bg-red-500');
      await user.click(removeButtons[0] as HTMLElement);

      expect(mockOnUpdate).toHaveBeenCalled();
      const callArg = mockOnUpdate.mock.calls[0][0];
      // When last photo is removed, should return empty array
      expect(callArg).toEqual([]);
    });
  });

  describe('Status Messages', () => {
    it('shows "0/2 required" when no photos captured', () => {
      render(<StepCapturePhotos photos={[]} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('0/2 required photos captured')).toBeInTheDocument();
    });

    it('shows "1/2 required" when one photo captured', () => {
      render(<StepCapturePhotos photos={['data:image/svg+xml,test1', '', '']} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('1/2 required photos captured')).toBeInTheDocument();
    });

    it('shows success message when 2 photos captured', () => {
      const photos = ['data:image/svg+xml,test1', 'data:image/svg+xml,test2', ''];
      render(<StepCapturePhotos photos={photos} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/2 photos captured — ready to proceed/i)).toBeInTheDocument();
    });

    it('shows success message when all 3 photos captured', () => {
      const photos = ['photo1', 'photo2', 'photo3'];
      render(<StepCapturePhotos photos={photos} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/3 photos captured — ready to proceed/i)).toBeInTheDocument();
    });

    it('shows yellow status when less than 2 photos', () => {
      const { container } = render(<StepCapturePhotos photos={['photo1', '', '']} onUpdate={mockOnUpdate} />);

      const statusBox = container.querySelector('.border-yellow-200');
      expect(statusBox).toBeInTheDocument();
    });

    it('shows green status when 2 or more photos', () => {
      const { container } = render(<StepCapturePhotos photos={['photo1', 'photo2', '']} onUpdate={mockOnUpdate} />);

      const statusBox = container.querySelector('.border-green-200');
      expect(statusBox).toBeInTheDocument();
    });
  });

  describe('Add Extra Photo', () => {
    it('shows "Add another photo" button when 3 photos are captured', () => {
      const photos = ['photo1', 'photo2', 'photo3'];
      render(<StepCapturePhotos photos={photos} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('Add another photo')).toBeInTheDocument();
    });

    it('does not show "Add another photo" button when less than 3 photos', () => {
      const photos = ['photo1', 'photo2', ''];
      render(<StepCapturePhotos photos={photos} onUpdate={mockOnUpdate} />);

      expect(screen.queryByText('Add another photo')).not.toBeInTheDocument();
    });

    it('adds extra photo when "Add another photo" is clicked', async () => {
      const user = userEvent.setup();
      const photos = ['photo1', 'photo2', 'photo3'];
      render(<StepCapturePhotos photos={photos} onUpdate={mockOnUpdate} />);

      const addButton = screen.getByText('Add another photo').closest('button');
      await user.click(addButton!);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled();
      });
      const callArg = mockOnUpdate.mock.calls[0][0];
      expect(callArg).toHaveLength(4);
      expect(callArg[3]).toContain('data:image/svg+xml');
    });
  });

  describe('Photo Count', () => {
    it('counts only non-empty photos', () => {
      const photos = ['photo1', '', 'photo3', '', ''];
      render(<StepCapturePhotos photos={photos} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/2 photos captured/i)).toBeInTheDocument();
    });

    it('handles empty array', () => {
      render(<StepCapturePhotos photos={[]} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('0/2 required photos captured')).toBeInTheDocument();
    });

    it('handles array with more than 3 photos', () => {
      const photos = ['photo1', 'photo2', 'photo3', 'photo4', 'photo5'];
      render(<StepCapturePhotos photos={photos} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/5 photos captured — ready to proceed/i)).toBeInTheDocument();
    });
  });
});
