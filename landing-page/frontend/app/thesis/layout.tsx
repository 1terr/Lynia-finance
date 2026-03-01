import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The 2026 Thesis — Lynia Finance',
  description:
    'We believe transaction velocity is a more accurate predictor of creditworthiness than a bank statement.',
};

export default function ThesisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
