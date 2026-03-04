import type { Metadata } from 'next';
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema';

export const metadata: Metadata = {
  title: 'Products — Lynia Finance',
  description:
    'Explore Lynia\u2019s three credit products built for Zimbabwe\u2019s underbanked: Digital Credit, Embedded Lending APIs, and Asset-Backed Financing. Join the waitlist today.',
  openGraph: {
    title: 'Products — Lynia Finance',
    description:
      'Explore Lynia\u2019s three credit products built for Zimbabwe\u2019s underbanked: Digital Credit, Embedded Lending APIs, and Asset-Backed Financing. Join the waitlist today.',
    url: '/products',
    images: [{ url: '/og-default.svg', width: 1200, height: 630, alt: 'Lynia Finance Products' }],
  },
};

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BreadcrumbSchema items={[{ name: 'Products', path: '/products' }]} />
      {children}
    </>
  );
}
