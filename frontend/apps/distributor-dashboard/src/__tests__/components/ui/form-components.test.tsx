import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

describe('UI Components', () => {
  describe('Input', () => {
    it('renders with placeholder', () => {
      render(<Input placeholder="Enter name" />);
      expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
    });

    it('renders with value', () => {
      render(<Input value="Test value" onChange={() => {}} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('Test value');
    });

    it('updates value on user input', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(<Input onChange={onChange} />);
      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      expect(onChange).toHaveBeenCalled();
    });

    it('applies error styles when error prop is true', () => {
      render(<Input error={true} data-testid="error-input" />);
      const input = screen.getByTestId('error-input');
      expect(input).toHaveClass('border-red-500');
    });

    it('does not apply error styles when error prop is false', () => {
      render(<Input error={false} data-testid="normal-input" />);
      const input = screen.getByTestId('normal-input');
      expect(input).not.toHaveClass('border-red-500');
    });

    it('disables when disabled prop is true', () => {
      render(<Input disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('applies custom className', () => {
      render(<Input className="custom-class" data-testid="custom-input" />);
      expect(screen.getByTestId('custom-input')).toHaveClass('custom-class');
    });

    it('supports different input types', () => {
      const { rerender } = render(<Input type="email" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');

      rerender(<Input type="password" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'password');

      rerender(<Input type="number" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'number');
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<Input ref={ref} />);
      expect(ref).toHaveBeenCalled();
    });

    it('supports all standard HTML input attributes', () => {
      render(
        <Input
          data-testid="full-input"
          required
          maxLength={10}
          minLength={2}
          pattern="[A-Z]*"
          autoComplete="off"
        />
      );
      const input = screen.getByTestId('full-input');
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('maxLength', '10');
      expect(input).toHaveAttribute('minLength', '2');
      expect(input).toHaveAttribute('pattern', '[A-Z]*');
      expect(input).toHaveAttribute('autoComplete', 'off');
    });
  });

  describe('Select', () => {
    it('renders with children options', () => {
      render(
        <Select>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('updates value on user selection', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(
        <Select onChange={onChange}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, '2');

      expect(onChange).toHaveBeenCalled();
    });

    it('applies error styles when error prop is true', () => {
      render(
        <Select error={true} data-testid="error-select">
          <option>Test</option>
        </Select>
      );
      const select = screen.getByTestId('error-select');
      expect(select).toHaveClass('border-red-500');
    });

    it('disables when disabled prop is true', () => {
      render(
        <Select disabled>
          <option>Test</option>
        </Select>
      );
      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('applies custom className', () => {
      render(
        <Select className="custom-class" data-testid="custom-select">
          <option>Test</option>
        </Select>
      );
      expect(screen.getByTestId('custom-select')).toHaveClass('custom-class');
    });

    it('renders chevron down icon', () => {
      const { container } = render(
        <Select>
          <option>Test</option>
        </Select>
      );
      const chevron = container.querySelector('.lucide-chevron-down');
      expect(chevron).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(
        <Select ref={ref}>
          <option>Test</option>
        </Select>
      );
      expect(ref).toHaveBeenCalled();
    });

    it('supports multiple select', () => {
      render(
        <Select multiple data-testid="multi-select">
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      const select = screen.getByTestId('multi-select');
      expect(select).toHaveAttribute('multiple');
    });

    it('supports required attribute', () => {
      render(
        <Select required data-testid="required-select">
          <option>Test</option>
        </Select>
      );
      expect(screen.getByTestId('required-select')).toHaveAttribute('required');
    });
  });

  describe('Card Components', () => {
    describe('Card', () => {
      it('renders children correctly', () => {
        render(<Card>Card content</Card>);
        expect(screen.getByText('Card content')).toBeInTheDocument();
      });

      it('applies custom className', () => {
        render(<Card className="custom-card" data-testid="card">Content</Card>);
        const card = screen.getByTestId('card');
        expect(card).toHaveClass('custom-card');
        expect(card).toHaveClass('rounded-lg');
      });

      it('renders as a div element', () => {
        const { container } = render(<Card>Content</Card>);
        expect(container.querySelector('div')).toBeInTheDocument();
      });

      it('supports standard div attributes', () => {
        render(<Card data-testid="card" aria-label="Test card">Content</Card>);
        const card = screen.getByTestId('card');
        expect(card).toHaveAttribute('aria-label', 'Test card');
      });
    });

    describe('CardHeader', () => {
      it('renders children correctly', () => {
        render(<CardHeader>Header content</CardHeader>);
        expect(screen.getByText('Header content')).toBeInTheDocument();
      });

      it('applies custom className', () => {
        render(<CardHeader className="custom-header" data-testid="header">Content</CardHeader>);
        const header = screen.getByTestId('header');
        expect(header).toHaveClass('custom-header');
        expect(header).toHaveClass('flex');
      });
    });

    describe('CardTitle', () => {
      it('renders as h3 heading', () => {
        render(<CardTitle>Test Title</CardTitle>);
        const heading = screen.getByText('Test Title');
        expect(heading.tagName).toBe('H3');
      });

      it('applies custom className', () => {
        render(<CardTitle className="custom-title">Title</CardTitle>);
        const title = screen.getByText('Title');
        expect(title).toHaveClass('custom-title');
        expect(title).toHaveClass('text-lg');
      });

      it('renders children correctly', () => {
        render(<CardTitle>My Card Title</CardTitle>);
        expect(screen.getByText('My Card Title')).toBeInTheDocument();
      });
    });

    describe('CardDescription', () => {
      it('renders as paragraph element', () => {
        render(<CardDescription>Test description</CardDescription>);
        const description = screen.getByText('Test description');
        expect(description.tagName).toBe('P');
      });

      it('applies custom className', () => {
        render(<CardDescription className="custom-desc">Description</CardDescription>);
        const desc = screen.getByText('Description');
        expect(desc).toHaveClass('custom-desc');
        expect(desc).toHaveClass('text-sm');
      });

      it('renders children correctly', () => {
        render(<CardDescription>My card description</CardDescription>);
        expect(screen.getByText('My card description')).toBeInTheDocument();
      });
    });

    describe('CardContent', () => {
      it('renders children correctly', () => {
        render(<CardContent>Content area</CardContent>);
        expect(screen.getByText('Content area')).toBeInTheDocument();
      });

      it('applies custom className', () => {
        render(<CardContent className="custom-content" data-testid="content">Text</CardContent>);
        const content = screen.getByTestId('content');
        expect(content).toHaveClass('custom-content');
        expect(content).toHaveClass('p-6');
      });
    });

    describe('CardFooter', () => {
      it('renders children correctly', () => {
        render(<CardFooter>Footer content</CardFooter>);
        expect(screen.getByText('Footer content')).toBeInTheDocument();
      });

      it('applies custom className', () => {
        render(<CardFooter className="custom-footer" data-testid="footer">Text</CardFooter>);
        const footer = screen.getByTestId('footer');
        expect(footer).toHaveClass('custom-footer');
        expect(footer).toHaveClass('flex');
      });
    });

    describe('Full Card Composition', () => {
      it('renders complete card structure', () => {
        render(
          <Card>
            <CardHeader>
              <CardTitle>Test Title</CardTitle>
              <CardDescription>Test Description</CardDescription>
            </CardHeader>
            <CardContent>Test Content</CardContent>
            <CardFooter>Test Footer</CardFooter>
          </Card>
        );

        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test Description')).toBeInTheDocument();
        expect(screen.getByText('Test Content')).toBeInTheDocument();
        expect(screen.getByText('Test Footer')).toBeInTheDocument();
      });

      it('allows nested components', () => {
        render(
          <Card>
            <CardHeader>
              <CardTitle>
                <span>Nested Title</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>Nested paragraph</p>
              <button>Action</button>
            </CardContent>
          </Card>
        );

        expect(screen.getByText('Nested Title')).toBeInTheDocument();
        expect(screen.getByText('Nested paragraph')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
      });
    });
  });
});
