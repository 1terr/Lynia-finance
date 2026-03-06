import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmationDialog } from '../confirmation-dialog';

describe('ConfirmationDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Confirm Action',
    description: 'Are you sure you want to proceed?',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<ConfirmationDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  it('renders title and description when open', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('renders default button labels', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('renders custom button labels', () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        confirmLabel="Delete"
        cancelLabel="Keep"
      />
    );
    expect(screen.getByText('Keep')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    render(<ConfirmationDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onClose when cancel button clicked', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when isLoading', () => {
    render(<ConfirmationDialog {...defaultProps} isLoading={true} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  describe('confirmInput', () => {
    it('disables confirm button until correct text is typed', () => {
      render(
        <ConfirmationDialog {...defaultProps} confirmInput="DELETE" />
      );
      const confirmBtn = screen.getByText('Confirm');
      expect(confirmBtn).toBeDisabled();
    });

    it('enables confirm button when correct text is typed', async () => {
      const user = userEvent.setup();
      render(
        <ConfirmationDialog {...defaultProps} confirmInput="DELETE" />
      );

      const input = screen.getByPlaceholderText('DELETE');
      await user.type(input, 'DELETE');

      const confirmBtn = screen.getByText('Confirm');
      expect(confirmBtn).not.toBeDisabled();
    });

    it('keeps confirm button disabled when wrong text is typed', async () => {
      const user = userEvent.setup();
      render(
        <ConfirmationDialog {...defaultProps} confirmInput="DELETE" />
      );

      const input = screen.getByPlaceholderText('DELETE');
      await user.type(input, 'wrong');

      const confirmBtn = screen.getByText('Confirm');
      expect(confirmBtn).toBeDisabled();
    });
  });

  describe('variants', () => {
    it('renders destructive variant', () => {
      render(<ConfirmationDialog {...defaultProps} variant="destructive" />);
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('renders warning variant', () => {
      render(<ConfirmationDialog {...defaultProps} variant="warning" />);
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('renders info variant', () => {
      render(<ConfirmationDialog {...defaultProps} variant="info" />);
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });
  });
});
