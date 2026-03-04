import type { Metadata } from 'next';
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema';

export const metadata: Metadata = {
  title: 'The 2026 Thesis — Lynia Finance',
  description:
    'Why transaction velocity is a more accurate predictor of creditworthiness than a bank statement. Read Lynia\u2019s thesis on credit infrastructure for Zimbabwe\u2019s informal economy.',
  openGraph: {
    title: 'The 2026 Thesis — Lynia Finance',
    description:
      'Why transaction velocity is a more accurate predictor of creditworthiness than a bank statement. Read Lynia\u2019s thesis on credit infrastructure for Zimbabwe\u2019s informal economy.',
    url: '/thesis',
    images: [{ url: '/og-default.svg', width: 1200, height: 630, alt: 'Lynia Finance — The 2026 Thesis' }],
  },
};

export default function ThesisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BreadcrumbSchema items={[{ name: 'The 2026 Thesis', path: '/thesis' }]} />
      {children}
    </>
  );
}
