import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { DocumentViewer } from '@/components/kyc-review/DocumentViewer';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    return <img {...rest} data-fill={fill ? 'true' : undefined} />;
  },
}));

jest.mock('@lynia/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('DocumentViewer', () => {
  const defaultProps = {
    idDocumentUrl: 'https://example.com/id-doc.jpg',
    selfieUrl: 'https://example.com/selfie.jpg',
  };

  it('renders ID document section with correct type label', () => {
    render(<DocumentViewer {...defaultProps} />);

    expect(screen.getByText(/National ID/)).toBeInTheDocument();
  });

  it('renders selfie section with "Live Selfie" label', () => {
    render(<DocumentViewer {...defaultProps} />);

    expect(screen.getByText(/Live Selfie/)).toBeInTheDocument();
  });

  it('uses custom idDocumentType when provided', () => {
    render(<DocumentViewer {...defaultProps} idDocumentType="Passport" />);

    expect(screen.getByText(/Passport/)).toBeInTheDocument();
    expect(screen.queryByText(/National ID/)).not.toBeInTheDocument();
  });

  it('renders images with correct alt text', () => {
    render(<DocumentViewer {...defaultProps} />);

    expect(screen.getByRole('img', { name: 'ID Document' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Customer Selfie' })).toBeInTheDocument();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<DocumentViewer {...defaultProps} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
