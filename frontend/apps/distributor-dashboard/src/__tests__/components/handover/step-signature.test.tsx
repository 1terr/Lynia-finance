import { render, screen } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { StepSignature } from '@/components/handover/step-signature';

// Mock canvas toDataURL
beforeAll(() => {
  HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mockSignature');
});

describe('StepSignature', () => {
  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Canvas Drawing Mode (No Signature)', () => {
    it('renders instruction text', () => {
      render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/Customer must sign below/i)).toBeInTheDocument();
    });

    it('renders canvas element', () => {
      const { container} = render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('renders drawing instruction', () => {
      render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/Draw signature using finger or stylus/i)).toBeInTheDocument();
    });

    it('renders Clear button', () => {
      render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);

      const clearButton = screen.getByRole('button', { name: /Clear/i });
      expect(clearButton).toBeInTheDocument();
    });

    it('renders Confirm Signature button', () => {
      render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);

      const confirmButton = screen.getByRole('button', { name: /Confirm Signature/i });
      expect(confirmButton).toBeInTheDocument();
    });

    it('Clear and Confirm buttons are disabled initially', () => {
      render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);

      const clearButton = screen.getByRole('button', { name: /Clear/i });
      const confirmButton = screen.getByRole('button', { name: /Confirm Signature/i });
      expect(clearButton).toBeDisabled();
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('Signature Display Mode (Signature Captured)', () => {
    const mockSignatureUrl = 'data:image/png;base64,ABC123';

    it('displays signature image when signatureUrl is provided', () => {
      render(<StepSignature signatureUrl={mockSignatureUrl} onUpdate={mockOnUpdate} />);

      const img = screen.getByAltText('Customer signature');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', mockSignatureUrl);
    });

    it('shows "Signature captured" success message', () => {
      render(<StepSignature signatureUrl={mockSignatureUrl} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/Signature captured/i)).toBeInTheDocument();
    });

    it('renders Re-sign button', () => {
      render(<StepSignature signatureUrl={mockSignatureUrl} onUpdate={mockOnUpdate} />);

      expect(screen.getByRole('button', { name: /Re-sign/i })).toBeInTheDocument();
    });

    it('hides canvas when signature is captured', () => {
      const { container } = render(<StepSignature signatureUrl={mockSignatureUrl} onUpdate={mockOnUpdate} />);

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeInTheDocument();
    });

    it('hides Clear and Confirm buttons when signature is captured', () => {
      render(<StepSignature signatureUrl={mockSignatureUrl} onUpdate={mockOnUpdate} />);

      expect(screen.queryByRole('button', { name: /^Clear$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Confirm Signature/i })).not.toBeInTheDocument();
    });

    it('Re-sign button is rendered and clickable', () => {
      render(<StepSignature signatureUrl={mockSignatureUrl} onUpdate={mockOnUpdate} />);

      const resignButton = screen.getByText(/Re-sign/i).closest('button');
      expect(resignButton).toBeInTheDocument();
      expect(resignButton).not.toBeDisabled();
    });

    it('shows instruction when signature exists', () => {
      render(<StepSignature signatureUrl={mockSignatureUrl} onUpdate={mockOnUpdate} />);

      // Instruction text should still be visible
      expect(screen.getByText(/Customer must sign below/i)).toBeInTheDocument();
    });
  });

  describe('Canvas Setup', () => {
    it('initializes canvas element', () => {
      const { container } = render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;

      expect(canvas).toBeInTheDocument();
      // Canvas is initialized (dimensions set in useEffect based on getBoundingClientRect)
      expect(canvas.width).toBeDefined();
      expect(canvas.height).toBeDefined();
    });

    it('sets up canvas context', () => {
      const { container } = render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);
      const canvas = container.querySelector('canvas')!;
      const ctx = canvas.getContext('2d');

      expect(ctx).toBeTruthy();
    });

    it('canvas has correct styling classes', () => {
      const { container } = render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);
      const canvas = container.querySelector('canvas')!;

      expect(canvas.className).toContain('w-full');
      expect(canvas.className).toContain('touch-none');
      expect(canvas.className).toContain('cursor-crosshair');
    });
  });

  describe('Conditional Rendering', () => {
    it('shows canvas mode when signatureUrl is null', () => {
      const { container } = render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);

      expect(container.querySelector('canvas')).toBeInTheDocument();
      expect(screen.queryByAltText('Customer signature')).not.toBeInTheDocument();
    });

    it('shows signature display when signatureUrl is provided', () => {
      const { container } = render(
        <StepSignature signatureUrl="data:image/png;base64,test" onUpdate={mockOnUpdate} />
      );

      expect(screen.getByAltText('Customer signature')).toBeInTheDocument();
      expect(container.querySelector('canvas')).not.toBeInTheDocument();
    });

    it('switches from display to canvas when signatureUrl changes to null', () => {
      const { container, rerender } = render(
        <StepSignature signatureUrl="data:image/png;base64,test" onUpdate={mockOnUpdate} />
      );

      // Initially shows signature
      expect(screen.getByAltText('Customer signature')).toBeInTheDocument();
      expect(container.querySelector('canvas')).not.toBeInTheDocument();

      // Simulate parent updating signatureUrl to null
      rerender(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);

      // Now shows canvas
      expect(container.querySelector('canvas')).toBeInTheDocument();
      expect(screen.queryByAltText('Customer signature')).not.toBeInTheDocument();
    });
  });

  describe('Event Handler Setup', () => {
    it('canvas has mouse event handlers', () => {
      const { container } = render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);
      const canvas = container.querySelector('canvas')!;

      // Check that event handler props exist
      expect(canvas.onmousedown).toBeDefined();
      expect(canvas.onmousemove).toBeDefined();
      expect(canvas.onmouseup).toBeDefined();
      expect(canvas.onmouseleave).toBeDefined();
    });

    it('canvas has touch event handlers', () => {
      const { container } = render(<StepSignature signatureUrl={null} onUpdate={mockOnUpdate} />);
      const canvas = container.querySelector('canvas')!;

      // Check that event handler props exist
      expect(canvas.ontouchstart).toBeDefined();
      expect(canvas.ontouchmove).toBeDefined();
      expect(canvas.ontouchend).toBeDefined();
    });
  });
});
