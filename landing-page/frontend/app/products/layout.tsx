import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Products — Lynia Finance',
  description:
    'Asset financing, digital credit, and enterprise partnerships. Three products built for Zimbabwe\u2019s underbanked majority.',
};

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
